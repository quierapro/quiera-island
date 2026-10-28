//! Everything that depends on the operating system lives under this module,
//! one submodule per platform. Code outside `platform` must stay portable:
//! CI compiles the crate on Windows, macOS and Linux to keep it that way.
//!
//! Each platform reports its `Capabilities`; a flag turns true only once the
//! feature is actually implemented and tested on that platform.

use serde::Serialize;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "linux")]
pub use linux::{
    capabilities, file_thumbnail, prepare_island_window, set_island_region, show_island_window,
    start_media, start_system_watch, wait_for_process_exit, watch_webview,
};
#[cfg(target_os = "macos")]
pub use macos::{
    capabilities, file_thumbnail, prepare_island_window, set_island_region, show_island_window,
    start_media, start_system_watch, wait_for_process_exit, watch_webview,
};
#[cfg(target_os = "windows")]
pub use windows::{
    capabilities, file_thumbnail, prepare_island_window, set_island_region, show_island_window,
    start_media, start_system_watch, wait_for_process_exit, watch_webview,
};

/// What the system tells the island about.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SystemEvent {
    /// Monitors, resolution or work area changed: re-place the island.
    DisplayChanged,
    /// Back from sleep or the lock screen.
    Resumed,
    /// Explorer restarted (the notification-area icon re-adds itself).
    TaskbarCreated,
    /// A fullscreen app took over the island's monitor, or left it.
    Fullscreen(bool),
}

/// A playback command for the current media session.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MediaCommand {
    PlayPause,
    Next,
    Previous,
    /// Position in ms from the start of the track.
    Seek(u64),
    SetShuffle(bool),
    SetRepeat(RepeatMode),
}

/// Repeat setting of the media session (`"none"`, `"track"`, `"list"` in JSON).
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RepeatMode {
    None,
    Track,
    List,
}

/// Sends commands to the platform's media session.
pub struct MediaControl(Box<dyn Fn(MediaCommand) + Send + Sync>);

impl MediaControl {
    pub fn new(send: impl Fn(MediaCommand) + Send + Sync + 'static) -> Self {
        Self(Box::new(send))
    }

    pub fn send(&self, command: MediaCommand) {
        (self.0)(command)
    }
}

/// How the web view failed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WebviewFailure {
    /// The page's process died or hung: reloading is enough.
    RendererGone,
    /// The whole web view is gone: the window must be rebuilt.
    BrowserGone,
}

/// Mirrors `Capabilities` in `src/ipc/capabilities.ts`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    pub platform: &'static str,
    pub island_window: bool,
    pub media: bool,
    pub volume: bool,
    pub power: bool,
}

impl Capabilities {
    pub const fn none(platform: &'static str) -> Self {
        Self {
            platform,
            island_window: false,
            media: false,
            volume: false,
            power: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_with_the_keys_the_frontend_expects() {
        let json = serde_json::to_value(Capabilities::none("windows")).unwrap();
        assert_eq!(
            json,
            serde_json::json!({
                "platform": "windows",
                "islandWindow": false,
                "media": false,
                "volume": false,
                "power": false
            })
        );
    }

    #[test]
    fn reports_the_platform_it_was_built_for() {
        let expected = if cfg!(target_os = "windows") {
            "windows"
        } else if cfg!(target_os = "macos") {
            "macos"
        } else {
            "linux"
        };
        assert_eq!(capabilities().platform, expected);
    }
}
