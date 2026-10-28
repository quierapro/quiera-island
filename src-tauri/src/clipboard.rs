//! Clipboard history: what was copied during this session, shown in the
//! island's Clipboard tab. Kept in memory only, never written to disk, and
//! never logged.

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::{LazyLock, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::http::{Response, StatusCode, header};
use tauri::{AppHandle, Emitter};

use crate::peeks::{self, SystemPeek};
use crate::shelf::{Rgba, encode_png};
use crate::{platform, protocol};

pub const CHANGED_EVENT: &str = "clipboard://changed";
pub const CLIP_SCHEME: &str = "quiera-clip";

/// Unpinned items kept; pinned ones do not count.
const MAX_ITEMS: usize = 30;
/// Unpinned images kept: they weigh much more than text.
const MAX_IMAGES: usize = 10;
/// Larger copies (a whole log file…) are not kept.
const MAX_TEXT_BYTES: usize = 1_000_000;
const PREVIEW_CHARS: usize = 300;
const PEEK_CHARS: usize = 60;
const THUMB_SIZE: u32 = 160;

/// What the platform reads from the clipboard, or writes back.
pub enum ClipContent {
    Text(String),
    Image(Rgba),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ClipKind {
    Text,
    Link,
    Image,
}

/// Mirrors `ClipItem` in `src/ipc/clipboard.ts`.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipItem {
    pub id: u32,
    pub kind: ClipKind,
    /// Text on one line, the link, or the image's size.
    pub preview: String,
    /// The site, for links.
    pub host: Option<String>,
    /// Thumbnail URL, for images.
    pub thumbnail: Option<String>,
    pub pinned: bool,
    /// Unix ms of the last copy.
    pub copied_at: u64,
}

enum Data {
    Text(String),
    Image { png: Vec<u8>, thumb: Vec<u8> },
}

struct Entry {
    item: ClipItem,
    /// Same content, same key: copying it again moves it up instead of
    /// adding a twin.
    key: u64,
    data: Data,
}

#[derive(Default)]
struct History {
    entries: Vec<Entry>,
    next_id: u32,
}

impl History {
    /// Adds a copy at the top, or moves its twin there. Returns its id.
    fn add(&mut self, key: u64, mut item: ClipItem, data: Data) -> u32 {
        if let Some(pos) = self.entries.iter().position(|e| e.key == key) {
            let mut entry = self.entries.remove(pos);
            entry.item.copied_at = item.copied_at;
            let id = entry.item.id;
            self.entries.insert(0, entry);
            return id;
        }
        self.next_id += 1;
        item.id = self.next_id;
        self.entries.insert(0, Entry { item, key, data });
        self.trim();
        self.next_id
    }

    /// Drops the oldest unpinned images, then the oldest unpinned items.
    fn trim(&mut self) {
        let mut images = 0;
        let mut items = 0;
        self.entries.retain(|e| {
            if e.item.pinned {
                return true;
            }
            items += 1;
            if e.item.kind == ClipKind::Image {
                images += 1;
            }
            items <= MAX_ITEMS && (e.item.kind != ClipKind::Image || images <= MAX_IMAGES)
        });
    }

    fn touch(&mut self, id: u32, now: u64) {
        if let Some(pos) = self.entries.iter().position(|e| e.item.id == id) {
            let mut entry = self.entries.remove(pos);
            entry.item.copied_at = now;
            self.entries.insert(0, entry);
        }
    }

    fn set_pinned(&mut self, id: u32, pinned: bool) {
        if let Some(e) = self.entries.iter_mut().find(|e| e.item.id == id) {
            e.item.pinned = pinned;
        }
        self.trim();
    }

    fn remove(&mut self, id: u32) {
        self.entries.retain(|e| e.item.id != id);
    }

    /// Empties the history, except what is pinned.
    fn clear(&mut self) {
        self.entries.retain(|e| e.item.pinned);
    }

    fn items(&self) -> Vec<ClipItem> {
        self.entries.iter().map(|e| e.item.clone()).collect()
    }

    fn get(&self, id: u32) -> Option<&Entry> {
        self.entries.iter().find(|e| e.item.id == id)
    }
}

static HISTORY: LazyLock<Mutex<History>> = LazyLock::new(Mutex::default);

fn history() -> std::sync::MutexGuard<'static, History> {
    HISTORY.lock().unwrap_or_else(|e| e.into_inner())
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_millis() as u64)
}

fn key_of(bytes: &[u8], extra: (u32, u32)) -> u64 {
    let mut hasher = DefaultHasher::new();
    bytes.hash(&mut hasher);
    extra.hash(&mut hasher);
    hasher.finish()
}

/// The text on one line, whitespace collapsed, cut at `max` characters.
pub fn one_line(text: &str, max: usize) -> String {
    let collapsed = text.split_whitespace().collect::<Vec<_>>().join(" ");
    match collapsed.char_indices().nth(max) {
        Some((cut, _)) => format!("{}…", &collapsed[..cut]),
        None => collapsed,
    }
}

/// The site of a copied link ("github.com"), when the whole copy is one.
pub fn link_host(text: &str) -> Option<String> {
    let text = text.trim();
    let rest = text
        .strip_prefix("https://")
        .or_else(|| text.strip_prefix("http://"))?;
    if text.contains(char::is_whitespace) {
        return None;
    }
    let host = rest.split(['/', '?', '#', ':']).next()?;
    let host = host.strip_prefix("www.").unwrap_or(host);
    (!host.is_empty() && host.contains('.')).then(|| host.to_owned())
}

/// A smaller copy for the list, averaging the pixels it merges.
pub fn downscale(image: &Rgba, max: u32) -> Rgba {
    let scale = (image.width.max(image.height) as f32 / max as f32).max(1.0);
    let width = ((image.width as f32 / scale).round() as u32).max(1);
    let height = ((image.height as f32 / scale).round() as u32).max(1);
    let mut pixels = Vec::with_capacity((width * height * 4) as usize);
    for y in 0..height {
        let y0 = y * image.height / height;
        let y1 = ((y + 1) * image.height / height).max(y0 + 1);
        for x in 0..width {
            let x0 = x * image.width / width;
            let x1 = ((x + 1) * image.width / width).max(x0 + 1);
            let mut sum = [0u32; 4];
            for sy in y0..y1 {
                for sx in x0..x1 {
                    let i = ((sy * image.width + sx) * 4) as usize;
                    for (c, s) in sum.iter_mut().enumerate() {
                        *s += u32::from(image.pixels[i + c]);
                    }
                }
            }
            let n = (y1 - y0) * (x1 - x0);
            pixels.extend(sum.iter().map(|s| (s / n) as u8));
        }
    }
    Rgba {
        width,
        height,
        pixels,
    }
}

fn decode_png(bytes: &[u8]) -> Option<Rgba> {
    let mut reader = png::Decoder::new(std::io::Cursor::new(bytes))
        .read_info()
        .ok()?;
    let mut pixels = vec![0; reader.output_buffer_size()?];
    let info = reader.next_frame(&mut pixels).ok()?;
    // Quiera wrote it: straight 8-bit RGBA.
    (info.color_type == png::ColorType::Rgba && info.bit_depth == png::BitDepth::Eight).then(|| {
        Rgba {
            width: info.width,
            height: info.height,
            pixels: pixels[..info.buffer_size()].to_vec(),
        }
    })
}

fn changed(app: &AppHandle) {
    if let Err(e) = app.emit(CHANGED_EVENT, history().items()) {
        log::warn!("could not send the clipboard history: {e}");
    }
}

/// Turns a copy into an item, its data and its key. None when it is not
/// worth keeping.
fn prepare(content: ClipContent, now: u64) -> Option<(u64, ClipItem, Data)> {
    let blank = |kind, preview, host, thumbnail| ClipItem {
        id: 0,
        kind,
        preview,
        host,
        thumbnail,
        pinned: false,
        copied_at: now,
    };
    match content {
        ClipContent::Text(text) => {
            if text.len() > MAX_TEXT_BYTES {
                return None;
            }
            let key = key_of(text.as_bytes(), (0, 0));
            let host = link_host(&text);
            let (kind, preview) = match &host {
                Some(_) => (ClipKind::Link, text.trim().to_owned()),
                None => (ClipKind::Text, one_line(&text, PREVIEW_CHARS)),
            };
            Some((key, blank(kind, preview, host, None), Data::Text(text)))
        }
        ClipContent::Image(image) => {
            let key = key_of(&image.pixels, (image.width, image.height));
            let png = encode_png(&image)?;
            let thumb = encode_png(&downscale(&image, THUMB_SIZE))?;
            let preview = format!("{} × {}", image.width, image.height);
            // The URL needs the id: filled in below.
            Some((
                key,
                blank(ClipKind::Image, preview, None, Some(String::new())),
                Data::Image { png, thumb },
            ))
        }
    }
}

fn on_copy(app: &AppHandle, content: ClipContent) {
    let now = now_ms();
    let Some((key, item, data)) = prepare(content, now) else {
        return;
    };
    let peek = {
        let mut history = history();
        let id = history.add(key, item, data);
        let entry = history.entries.iter_mut().find(|e| e.item.id == id);
        entry.map(|e| {
            if e.item.thumbnail.is_some() {
                e.item.thumbnail = Some(protocol::url(CLIP_SCHEME, &format!("{id}-{now}")));
            }
            SystemPeek::Copied {
                content: e.item.kind,
                preview: one_line(
                    e.item.host.as_deref().unwrap_or(&e.item.preview),
                    PEEK_CHARS,
                ),
                thumbnail: e.item.thumbnail.clone(),
            }
        })
    };
    changed(app);
    if let Some(peek) = peek {
        peeks::announce(app, peek);
    }
}

pub fn start(app: &AppHandle) {
    let app = app.clone();
    platform::start_clipboard_watch(move |content| on_copy(&app, content));
}

#[tauri::command]
pub fn clipboard_items() -> Vec<ClipItem> {
    history().items()
}

/// Puts an item back on the clipboard and moves it to the top.
#[tauri::command]
pub fn clipboard_copy(app: AppHandle, id: u32) -> Result<(), String> {
    let content = {
        let history = history();
        let entry = history.get(id).ok_or("no such item")?;
        match &entry.data {
            Data::Text(text) => ClipContent::Text(text.clone()),
            Data::Image { png, .. } => {
                ClipContent::Image(decode_png(png).ok_or("unreadable image")?)
            }
        }
    };
    platform::write_clipboard(&content)?;
    history().touch(id, now_ms());
    changed(&app);
    Ok(())
}

#[tauri::command]
pub fn clipboard_pin(app: AppHandle, id: u32, pinned: bool) {
    history().set_pinned(id, pinned);
    changed(&app);
}

#[tauri::command]
pub fn clipboard_remove(app: AppHandle, id: u32) {
    history().remove(id);
    changed(&app);
}

#[tauri::command]
pub fn clipboard_clear(app: AppHandle) {
    history().clear();
    changed(&app);
}

/// Serves an image item's thumbnail: `/<id>-<version>`.
pub fn serve_thumbnail(path: &str) -> Response<Vec<u8>> {
    let id = path
        .trim_start_matches('/')
        .split('-')
        .next()
        .and_then(|id| id.parse().ok());
    let png = id.and_then(|id| match &history().get(id)?.data {
        Data::Image { thumb, .. } => Some(thumb.clone()),
        Data::Text(_) => None,
    });
    let response = match png {
        Some(png) => Response::builder()
            .header(header::CONTENT_TYPE, "image/png")
            .header(header::CACHE_CONTROL, "max-age=3600")
            .body(png),
        None => Response::builder()
            .status(StatusCode::NOT_FOUND)
            .body(Vec::new()),
    };
    response.unwrap_or_else(|_| Response::new(Vec::new()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn text(history: &mut History, s: &str, now: u64) -> u32 {
        let (key, item, data) = prepare(ClipContent::Text(s.into()), now).unwrap();
        history.add(key, item, data)
    }

    fn image(history: &mut History, seed: u8) -> u32 {
        let rgba = Rgba {
            width: 2,
            height: 1,
            pixels: vec![seed; 8],
        };
        let (key, item, data) = prepare(ClipContent::Image(rgba), 0).unwrap();
        history.add(key, item, data)
    }

    fn previews(history: &History) -> Vec<String> {
        history.items().into_iter().map(|i| i.preview).collect()
    }

    #[test]
    fn newest_first_and_a_copy_again_moves_up() {
        let mut h = History::default();
        let a = text(&mut h, "a", 1);
        text(&mut h, "b", 2);
        assert_eq!(text(&mut h, "a", 3), a);
        assert_eq!(previews(&h), ["a", "b"]);
        assert_eq!(h.items()[0].copied_at, 3);
    }

    #[test]
    fn keeps_the_newest_items_and_images_but_all_pinned() {
        let mut h = History::default();
        let pinned = text(&mut h, "keep", 0);
        h.set_pinned(pinned, true);
        for i in 0..MAX_IMAGES + 3 {
            image(&mut h, i as u8);
        }
        for i in 0..MAX_ITEMS {
            text(&mut h, &i.to_string(), 0);
        }
        let items = h.items();
        assert_eq!(items.len(), MAX_ITEMS + 1);
        assert!(items.iter().any(|i| i.id == pinned));
        assert_eq!(previews(&h)[0], (MAX_ITEMS - 1).to_string());

        let mut h = History::default();
        for i in 0..MAX_IMAGES + 3 {
            image(&mut h, i as u8);
        }
        assert_eq!(h.items().len(), MAX_IMAGES);
    }

    #[test]
    fn clear_keeps_pinned_and_touch_moves_up() {
        let mut h = History::default();
        let a = text(&mut h, "a", 1);
        let b = text(&mut h, "b", 2);
        h.touch(a, 5);
        assert_eq!(previews(&h), ["a", "b"]);
        h.set_pinned(b, true);
        h.clear();
        assert_eq!(previews(&h), ["b"]);
        h.remove(b);
        assert!(h.items().is_empty());
    }

    #[test]
    fn links_and_previews() {
        assert_eq!(
            link_host("https://www.github.com/quiera?x=1").as_deref(),
            Some("github.com")
        );
        assert_eq!(
            link_host("  http://lrclib.net:443/api  ").as_deref(),
            Some("lrclib.net")
        );
        assert_eq!(link_host("see https://a.com"), None);
        assert_eq!(link_host("https://localhost"), None);
        assert_eq!(one_line("  a\n\n b\tc ", 10), "a b c");
        assert_eq!(one_line("abcdef", 3), "abc…");

        let (_, item, _) = prepare(ClipContent::Text("https://github.com/x".into()), 0).unwrap();
        assert_eq!(
            (item.kind, item.host.as_deref()),
            (ClipKind::Link, Some("github.com"))
        );
        assert!(prepare(ClipContent::Text("x".repeat(MAX_TEXT_BYTES + 1)), 0).is_none());
    }

    #[test]
    fn downscale_averages_and_keeps_the_ratio() {
        let image = Rgba {
            width: 4,
            height: 2,
            pixels: [[0, 0, 0, 255], [255, 255, 255, 255]].concat().repeat(4),
        };
        let small = downscale(&image, 2);
        assert_eq!((small.width, small.height), (2, 1));
        assert_eq!(&small.pixels[..4], &[127, 127, 127, 255]);
        assert_eq!(downscale(&image, 100).width, 4);
    }

    #[test]
    fn png_round_trip() {
        let image = Rgba {
            width: 3,
            height: 2,
            pixels: (0..24).collect(),
        };
        let back = decode_png(&encode_png(&image).unwrap()).unwrap();
        assert_eq!((back.width, back.height, back.pixels), (3, 2, image.pixels));
    }
}
