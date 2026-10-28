//! The Shelf: files dropped on the island, kept for later and dragged out
//! again. Files are kept by reference (their path), never copied; the shelf
//! lasts for the session.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, LazyLock, Mutex, OnceLock};

use serde::Serialize;
use tauri::http::{Response, StatusCode, header};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_opener::OpenerExt;

use crate::{platform, protocol};

pub const THUMB_SCHEME: &str = "quiera-thumb";
pub const CHANGED_EVENT: &str = "shelf://changed";

/// Oldest items leave beyond this.
const MAX_ITEMS: usize = 30;
/// Thumbnail side in pixels (tiles show them at 52 px, so 2× and a margin).
const THUMB_SIZE: u32 = 128;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ItemKind {
    File,
    Folder,
    Image,
}

/// Mirrors `ShelfItem` in `src/ipc/shelf.ts`.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShelfItem {
    pub id: u32,
    pub path: String,
    pub name: String,
    pub kind: ItemKind,
    /// Bytes, for files.
    pub size: Option<u64>,
    /// URL of the thumbnail, served by the `quiera-thumb` protocol.
    pub thumbnail: String,
}

const IMAGE_EXTENSIONS: [&str; 9] = [
    "png", "jpg", "jpeg", "gif", "webp", "bmp", "heic", "avif", "tiff",
];

pub fn kind_for(path: &Path, is_dir: bool) -> ItemKind {
    if is_dir {
        return ItemKind::Folder;
    }
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase);
    match ext {
        Some(e) if IMAGE_EXTENSIONS.contains(&e.as_str()) => ItemKind::Image,
        _ => ItemKind::File,
    }
}

/// A dropped entry with what the file system says about it.
pub struct Entry {
    pub path: PathBuf,
    pub kind: ItemKind,
    pub size: Option<u64>,
}

pub struct Shelf {
    next_id: u32,
    items: Vec<ShelfItem>,
}

impl Shelf {
    pub const fn new() -> Self {
        Self {
            next_id: 1,
            items: Vec::new(),
        }
    }

    pub fn items(&self) -> Vec<ShelfItem> {
        self.items.clone()
    }

    pub fn get(&self, id: u32) -> Option<&ShelfItem> {
        self.items.iter().find(|i| i.id == id)
    }

    /// Adds entries not already on the shelf, newest first. Returns the ids
    /// that left because the shelf was full.
    pub fn add(&mut self, entries: impl IntoIterator<Item = Entry>) -> Vec<u32> {
        for entry in entries {
            let path = entry.path.to_string_lossy().into_owned();
            if self.items.iter().any(|i| i.path == path) {
                continue;
            }
            let id = self.next_id;
            self.next_id += 1;
            let name = entry
                .path
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| path.clone());
            self.items.insert(
                0,
                ShelfItem {
                    id,
                    path,
                    name,
                    kind: entry.kind,
                    size: entry.size,
                    thumbnail: protocol::url(THUMB_SCHEME, &id.to_string()),
                },
            );
        }
        let overflow = self.items.len().saturating_sub(MAX_ITEMS);
        self.items
            .drain(self.items.len() - overflow..)
            .map(|i| i.id)
            .collect()
    }

    pub fn remove(&mut self, id: u32) -> bool {
        let before = self.items.len();
        self.items.retain(|i| i.id != id);
        self.items.len() != before
    }

    pub fn clear(&mut self) -> Vec<u32> {
        self.items.drain(..).map(|i| i.id).collect()
    }

    /// Drops items whose file is gone (moved or deleted). Returns their ids.
    pub fn retain_existing(&mut self, exists: impl Fn(&Path) -> bool) -> Vec<u32> {
        let (keep, gone): (Vec<_>, Vec<_>) = self
            .items
            .drain(..)
            .partition(|i| exists(Path::new(&i.path)));
        self.items = keep;
        gone.into_iter().map(|i| i.id).collect()
    }
}

static SHELF: Mutex<Shelf> = Mutex::new(Shelf::new());
static THUMBS: LazyLock<Mutex<HashMap<u32, Arc<Vec<u8>>>>> = LazyLock::new(Default::default);

fn shelf() -> std::sync::MutexGuard<'static, Shelf> {
    SHELF.lock().unwrap_or_else(|e| e.into_inner())
}

fn forget_thumbnails(ids: &[u32]) {
    let mut thumbs = THUMBS.lock().unwrap_or_else(|e| e.into_inner());
    for id in ids {
        thumbs.remove(id);
    }
}

fn changed(app: &AppHandle) {
    let items = shelf().items();
    if let Err(e) = app.emit(CHANGED_EVENT, items) {
        log::warn!("could not send the shelf: {e}");
    }
}

/// Puts dropped files on the shelf.
pub fn add_paths(app: &AppHandle, paths: Vec<PathBuf>) {
    let entries = paths.into_iter().filter_map(|path| {
        let meta = std::fs::metadata(&path).ok()?;
        Some(Entry {
            kind: kind_for(&path, meta.is_dir()),
            size: meta.is_file().then_some(meta.len()),
            path,
        })
    });
    let gone = shelf().add(entries.collect::<Vec<_>>());
    forget_thumbnails(&gone);
    changed(app);
}

/// Receives the files dropped on the island.
pub fn watch_drops(app: &AppHandle) {
    let Some(window) = app.get_webview_window(crate::island::LABEL) else {
        return;
    };
    let handle = app.clone();
    platform::watch_file_drops(&window, move |paths| add_paths(&handle, paths));
}

fn item_path(id: u32) -> Result<PathBuf, String> {
    shelf()
        .get(id)
        .map(|i| PathBuf::from(&i.path))
        .ok_or_else(|| format!("no shelf item {id}"))
}

/// The items, after dropping those whose file is gone.
#[tauri::command]
pub fn shelf_items(app: AppHandle) -> Vec<ShelfItem> {
    let gone = shelf().retain_existing(Path::exists);
    if !gone.is_empty() {
        forget_thumbnails(&gone);
        changed(&app);
    }
    shelf().items()
}

#[tauri::command]
pub fn shelf_remove(app: AppHandle, id: u32) {
    if shelf().remove(id) {
        forget_thumbnails(&[id]);
        changed(&app);
    }
}

#[tauri::command]
pub fn shelf_clear(app: AppHandle) {
    let gone = shelf().clear();
    forget_thumbnails(&gone);
    changed(&app);
}

#[tauri::command]
pub fn shelf_open(app: AppHandle, id: u32) -> Result<(), String> {
    let path = item_path(id)?;
    app.opener()
        .open_path(path.to_string_lossy(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn shelf_reveal(app: AppHandle, id: u32) -> Result<(), String> {
    let path = item_path(id)?;
    app.opener()
        .reveal_item_in_dir(&path)
        .map_err(|e| e.to_string())
}

fn thumbnail(id: u32) -> Option<Arc<Vec<u8>>> {
    if let Some(png) = THUMBS.lock().unwrap_or_else(|e| e.into_inner()).get(&id) {
        return Some(png.clone());
    }
    let path = item_path(id).ok()?;
    let png = Arc::new(platform::file_thumbnail(&path, THUMB_SIZE)?);
    THUMBS
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .insert(id, png.clone());
    Some(png)
}

/// The preview shown under the cursor when dragging an item out: the
/// thumbnail, written to the cache folder (the drag API wants a file).
#[tauri::command]
pub fn shelf_drag_icon(app: AppHandle, id: u32) -> Result<String, String> {
    let png = thumbnail(id).ok_or("no thumbnail")?;
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("drag-icons");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let file = dir.join(format!("{id}.png"));
    std::fs::write(&file, png.as_slice()).map_err(|e| e.to_string())?;
    Ok(file.to_string_lossy().into_owned())
}

type ThumbnailRequest = (String, tauri::UriSchemeResponder);

static THUMB_WORKER: OnceLock<Sender<ThumbnailRequest>> = OnceLock::new();

/// Queues a `quiera-thumb` request. Thumbnails are rendered one at a time on
/// one thread, off the main thread: the shell can take a while, and some
/// installed preview handlers fail when called from several threads at once.
pub fn queue_thumbnail(path: String, responder: tauri::UriSchemeResponder) {
    let worker = THUMB_WORKER.get_or_init(|| {
        let (tx, rx) = mpsc::channel::<ThumbnailRequest>();
        let spawned = std::thread::Builder::new()
            .name("quiera-thumbnails".into())
            .spawn(move || {
                for (path, responder) in rx {
                    responder.respond(serve_thumbnail(&path));
                }
            });
        if let Err(e) = spawned {
            log::error!("could not start the thumbnail worker: {e}");
        }
        tx
    });
    if let Err(mpsc::SendError((_, responder))) = worker.send((path, responder)) {
        responder.respond(
            Response::builder()
                .status(StatusCode::SERVICE_UNAVAILABLE)
                .body(Vec::new())
                .unwrap_or_default(),
        );
    }
}

/// Serves `quiera-thumb://localhost/<id>`.
pub fn serve_thumbnail(path: &str) -> Response<Vec<u8>> {
    let png = path
        .trim_start_matches('/')
        .parse()
        .ok()
        .and_then(thumbnail);
    let response = match png {
        Some(png) => Response::builder()
            .header(header::CONTENT_TYPE, "image/png")
            .header(header::CACHE_CONTROL, "max-age=3600")
            .body(png.as_slice().to_vec()),
        None => Response::builder()
            .status(StatusCode::NOT_FOUND)
            .body(Vec::new()),
    };
    response.unwrap_or_else(|_| Response::new(Vec::new()))
}

/// An image as straight RGBA, top row first.
pub struct Rgba {
    pub width: u32,
    pub height: u32,
    pub pixels: Vec<u8>,
}

impl Rgba {
    /// From the BGRA rows Windows bitmaps use, with premultiplied alpha.
    /// Bitmaps without alpha report 0 everywhere: they are opaque.
    pub fn from_premultiplied_bgra(mut pixels: Vec<u8>, width: u32, height: u32) -> Self {
        let no_alpha = pixels.as_chunks::<4>().0.iter().all(|p| p[3] == 0);
        for p in pixels.as_chunks_mut::<4>().0 {
            p.swap(0, 2);
            if no_alpha {
                p[3] = 255;
            } else if p[3] > 0 && p[3] < 255 {
                let a = u32::from(p[3]);
                for c in &mut p[..3] {
                    *c = ((u32::from(*c) * 255 + a / 2) / a).min(255) as u8;
                }
            }
        }
        Self {
            width,
            height,
            pixels,
        }
    }
}

pub fn encode_png(image: &Rgba) -> Option<Vec<u8>> {
    let mut out = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut out, image.width, image.height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().ok()?;
        writer.write_image_data(&image.pixels).ok()?;
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(path: &str) -> Entry {
        Entry {
            path: PathBuf::from(path),
            kind: ItemKind::File,
            size: Some(1),
        }
    }

    #[test]
    fn recognises_images_and_folders() {
        assert_eq!(
            kind_for(Path::new("C:/a/Photo.JPG"), false),
            ItemKind::Image
        );
        assert_eq!(kind_for(Path::new("C:/a/doc.pdf"), false), ItemKind::File);
        assert_eq!(
            kind_for(Path::new("C:/a/folder.png"), true),
            ItemKind::Folder
        );
        assert_eq!(kind_for(Path::new("C:/a/noext"), false), ItemKind::File);
    }

    #[test]
    fn adds_newest_first_without_duplicates() {
        let mut shelf = Shelf::new();
        shelf.add([entry("C:/a.txt"), entry("C:/b.txt")]);
        shelf.add([entry("C:/a.txt"), entry("C:/c.txt")]);
        let names: Vec<_> = shelf.items().into_iter().map(|i| i.name).collect();
        assert_eq!(names, ["c.txt", "b.txt", "a.txt"]);
    }

    #[test]
    fn gives_each_item_its_own_id_and_thumbnail_url() {
        let mut shelf = Shelf::new();
        shelf.add([entry("C:/a.txt"), entry("C:/b.txt")]);
        let items = shelf.items();
        assert_ne!(items[0].id, items[1].id);
        assert!(items[0].thumbnail.ends_with(&items[0].id.to_string()));
    }

    #[test]
    fn drops_the_oldest_beyond_the_limit() {
        let mut shelf = Shelf::new();
        let gone = shelf.add((0..MAX_ITEMS + 2).map(|i| entry(&format!("C:/{i}.txt"))));
        assert_eq!(shelf.items().len(), MAX_ITEMS);
        assert_eq!(gone.len(), 2);
        assert_eq!(shelf.items().last().unwrap().name, "2.txt");
    }

    #[test]
    fn removes_clears_and_forgets_missing_files() {
        let mut shelf = Shelf::new();
        shelf.add([entry("C:/a.txt"), entry("C:/gone.txt"), entry("C:/b.txt")]);
        let gone = shelf.retain_existing(|p| !p.ends_with("gone.txt"));
        assert_eq!(gone.len(), 1);
        let first = shelf.items()[0].id;
        assert!(shelf.remove(first));
        assert!(!shelf.remove(first));
        assert_eq!(shelf.clear().len(), 1);
        assert!(shelf.items().is_empty());
    }

    #[test]
    fn converts_premultiplied_bgra_to_straight_rgba() {
        // Half-transparent red: premultiplied (0, 0, 128, 128) in BGRA.
        let image = Rgba::from_premultiplied_bgra(vec![0, 0, 128, 128], 1, 1);
        assert_eq!(image.pixels, [255, 0, 0, 128]);
    }

    #[test]
    fn treats_bitmaps_without_alpha_as_opaque() {
        let image = Rgba::from_premultiplied_bgra(vec![10, 20, 30, 0, 1, 2, 3, 0], 2, 1);
        assert_eq!(image.pixels, [30, 20, 10, 255, 3, 2, 1, 255]);
    }

    #[test]
    fn encodes_a_png() {
        let png = encode_png(&Rgba {
            width: 1,
            height: 1,
            pixels: vec![255, 0, 0, 255],
        })
        .unwrap();
        assert_eq!(&png[..8], b"\x89PNG\r\n\x1a\n");
    }
}
