//! Now playing: what the system's media session reports, turned into the
//! state the island shows, plus the playback commands.
//!
//! The platform layer reports snapshots when something changes (no
//! polling); this module dedupes them, keeps the artwork in a small cache
//! served through the `quiera-art` protocol, and emits `media://state`.

use std::collections::VecDeque;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::sync::{Arc, Mutex, OnceLock};

use serde::Serialize;
use tauri::http::{Response, StatusCode, header};
use tauri::{AppHandle, Emitter};

pub use crate::platform::RepeatMode;
use crate::platform::{self, MediaCommand, MediaControl};

pub const STATE_EVENT: &str = "media://state";
pub const ART_SCHEME: &str = "quiera-art";

/// Cover art as the media app provided it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Artwork {
    pub bytes: Vec<u8>,
    pub mime: String,
}

/// What the platform reports about the current media session.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct MediaSnapshot {
    pub app_id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub playing: bool,
    pub position_ms: Option<u64>,
    pub duration_ms: Option<u64>,
    /// When `position_ms` was true (Unix time, ms): the UI extrapolates from it.
    pub position_at_ms: u64,
    pub can_seek: bool,
    pub can_previous: bool,
    pub can_next: bool,
    pub can_play_pause: bool,
    /// None when the app does not report it.
    pub shuffle: Option<bool>,
    pub repeat: Option<RepeatMode>,
    pub can_shuffle: bool,
    pub can_repeat: bool,
    pub artwork: Option<Arc<Artwork>>,
}

/// Mirrors `MediaState` in `src/ipc/media.ts`.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaState {
    pub app_id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub playing: bool,
    pub position_ms: Option<u64>,
    pub duration_ms: Option<u64>,
    pub position_at: u64,
    pub can_seek: bool,
    pub can_previous: bool,
    pub can_next: bool,
    pub can_play_pause: bool,
    pub shuffle: Option<bool>,
    pub repeat: Option<RepeatMode>,
    pub can_shuffle: bool,
    pub can_repeat: bool,
    /// URL of the cover art, served by the `quiera-art` protocol.
    pub artwork: Option<String>,
}

pub fn artwork_key(art: &Artwork) -> String {
    let mut hasher = DefaultHasher::new();
    art.bytes.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// The URL a web view loads a custom-protocol resource from (Windows web
/// views see custom schemes as `http://<scheme>.localhost`).
pub fn artwork_url(key: &str) -> String {
    crate::protocol::url(ART_SCHEME, key)
}

pub fn state_from(snapshot: &MediaSnapshot) -> MediaState {
    MediaState {
        app_id: snapshot.app_id.clone(),
        title: snapshot.title.clone(),
        artist: snapshot.artist.clone(),
        album: snapshot.album.clone(),
        playing: snapshot.playing,
        position_ms: snapshot.position_ms,
        duration_ms: snapshot.duration_ms,
        position_at: snapshot.position_at_ms,
        can_seek: snapshot.can_seek,
        can_previous: snapshot.can_previous,
        can_next: snapshot.can_next,
        can_play_pause: snapshot.can_play_pause,
        shuffle: snapshot.shuffle,
        repeat: snapshot.repeat,
        can_shuffle: snapshot.can_shuffle,
        can_repeat: snapshot.can_repeat,
        artwork: snapshot
            .artwork
            .as_deref()
            .map(|a| artwork_url(&artwork_key(a))),
    }
}

/// The last few covers, so a crossfade can still load the previous one.
#[derive(Default)]
pub struct ArtCache {
    entries: VecDeque<(String, Arc<Artwork>)>,
}

impl ArtCache {
    const CAPACITY: usize = 3;

    pub const fn new() -> Self {
        Self {
            entries: VecDeque::new(),
        }
    }

    pub fn insert(&mut self, art: Arc<Artwork>) {
        let key = artwork_key(&art);
        if self.entries.iter().any(|(k, _)| *k == key) {
            return;
        }
        if self.entries.len() == Self::CAPACITY {
            self.entries.pop_front();
        }
        self.entries.push_back((key, art));
    }

    pub fn get(&self, key: &str) -> Option<Arc<Artwork>> {
        self.entries
            .iter()
            .find(|(k, _)| k == key)
            .map(|(_, a)| a.clone())
    }
}

// Separate statics: the platform may report a first snapshot before
// `start_media` has returned the control handle.
static STATE: Mutex<Option<MediaState>> = Mutex::new(None);
static ART: Mutex<ArtCache> = Mutex::new(ArtCache::new());
static CONTROL: OnceLock<MediaControl> = OnceLock::new();

pub fn start(handle: &AppHandle) {
    let handle = handle.clone();
    let control = platform::start_media(move |snapshot| {
        if let Some(art) = snapshot.as_ref().and_then(|s| s.artwork.clone()) {
            ART.lock().unwrap_or_else(|e| e.into_inner()).insert(art);
        }
        let next = snapshot.as_ref().map(state_from);
        let mut state = STATE.lock().unwrap_or_else(|e| e.into_inner());
        if *state == next {
            return;
        }
        if state.as_ref().map(|s| &s.app_id) != next.as_ref().map(|s| &s.app_id) {
            // The app only, never what is playing: the log is not a listening history.
            log::info!(
                "media session: {}",
                next.as_ref().map_or("none", |s| s.app_id.as_str())
            );
        }
        if cfg!(debug_assertions)
            && let Some(s) = &next
        {
            log::info!(
                "[dev] media: playing={} metadata={} duration={} seek={} artwork={}",
                s.playing,
                !s.title.is_empty(),
                s.duration_ms.is_some(),
                s.can_seek,
                s.artwork.is_some()
            );
        }
        state.clone_from(&next);
        drop(state);
        if let Err(e) = handle.emit(STATE_EVENT, next) {
            log::warn!("could not send the media state: {e}");
        }
    });
    if let Some(control) = control
        && CONTROL.set(control).is_err()
    {
        log::warn!("media started twice");
    }
}

/// Serves `quiera-art://localhost/<key>` from the cover cache.
pub fn serve_artwork(path: &str) -> Response<Vec<u8>> {
    let key = path.trim_start_matches('/');
    let art = ART.lock().unwrap_or_else(|e| e.into_inner()).get(key);
    let response = match art {
        Some(art) => Response::builder()
            .header(header::CONTENT_TYPE, art.mime.as_str())
            // Lets the UI read the pixels (accent colour) from a canvas.
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .header(header::CACHE_CONTROL, "max-age=31536000, immutable")
            .body(art.bytes.clone()),
        None => Response::builder()
            .status(StatusCode::NOT_FOUND)
            // Not cached by the web view: it may come later.
            .header(header::CACHE_CONTROL, "no-store")
            .body(Vec::new()),
    };
    response.unwrap_or_else(|_| Response::new(Vec::new()))
}

/// What is playing now, for a UI that starts (or reloads) after the last event.
#[tauri::command]
pub fn get_media() -> Option<MediaState> {
    STATE.lock().unwrap_or_else(|e| e.into_inner()).clone()
}

fn send(command: MediaCommand) -> Result<(), String> {
    match CONTROL.get() {
        Some(control) => {
            control.send(command);
            Ok(())
        }
        None => Err("media control is not available on this platform".into()),
    }
}

#[tauri::command]
pub fn media_play_pause() -> Result<(), String> {
    send(MediaCommand::PlayPause)
}

#[tauri::command]
pub fn media_next() -> Result<(), String> {
    send(MediaCommand::Next)
}

#[tauri::command]
pub fn media_previous() -> Result<(), String> {
    send(MediaCommand::Previous)
}

#[tauri::command]
pub fn media_seek(position_ms: u64) -> Result<(), String> {
    send(MediaCommand::Seek(position_ms))
}

#[tauri::command]
pub fn media_set_shuffle(active: bool) -> Result<(), String> {
    send(MediaCommand::SetShuffle(active))
}

#[tauri::command]
pub fn media_set_repeat(mode: RepeatMode) -> Result<(), String> {
    send(MediaCommand::SetRepeat(mode))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn art(bytes: &[u8]) -> Arc<Artwork> {
        Arc::new(Artwork {
            bytes: bytes.to_vec(),
            mime: "image/png".into(),
        })
    }

    #[test]
    fn the_same_cover_always_gets_the_same_key() {
        assert_eq!(artwork_key(&art(b"abc")), artwork_key(&art(b"abc")));
        assert_ne!(artwork_key(&art(b"abc")), artwork_key(&art(b"abd")));
    }

    #[test]
    fn state_points_the_artwork_to_the_protocol() {
        let snapshot = MediaSnapshot {
            title: "t".into(),
            artwork: Some(art(b"cover")),
            ..Default::default()
        };
        let url = state_from(&snapshot).artwork.unwrap();
        let key = artwork_key(&art(b"cover"));
        assert!(url.ends_with(&key), "{url}");
        assert!(url.contains(ART_SCHEME), "{url}");
    }

    #[test]
    fn state_has_no_artwork_when_the_app_gives_none() {
        assert_eq!(state_from(&MediaSnapshot::default()).artwork, None);
    }

    #[test]
    fn cache_keeps_the_last_three_covers() {
        let mut cache = ArtCache::default();
        let covers: Vec<_> = (0u8..4).map(|i| art(&[i])).collect();
        for c in &covers {
            cache.insert(c.clone());
        }
        assert!(cache.get(&artwork_key(&covers[0])).is_none());
        for c in &covers[1..] {
            assert!(cache.get(&artwork_key(c)).is_some());
        }
    }

    #[test]
    fn cache_ignores_a_cover_it_already_has() {
        let mut cache = ArtCache::default();
        for _ in 0..5 {
            cache.insert(art(b"same"));
        }
        cache.insert(art(b"other"));
        cache.insert(art(b"third"));
        assert!(cache.get(&artwork_key(&art(b"same"))).is_some());
    }

    #[test]
    fn state_serializes_with_the_keys_the_frontend_expects() {
        let json = serde_json::to_value(state_from(&MediaSnapshot::default())).unwrap();
        let keys: Vec<_> = json.as_object().unwrap().keys().cloned().collect();
        for key in [
            "appId",
            "title",
            "artist",
            "album",
            "playing",
            "positionMs",
            "durationMs",
            "positionAt",
            "canSeek",
            "canPrevious",
            "canNext",
            "canPlayPause",
            "shuffle",
            "repeat",
            "canShuffle",
            "canRepeat",
            "artwork",
        ] {
            assert!(keys.contains(&key.to_string()), "missing {key}");
        }
    }
}
