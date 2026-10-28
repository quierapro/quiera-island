//! macOS: not implemented yet. Compiled in CI so portable code stays portable.

use tauri::WebviewWindow;

use super::Capabilities;
use crate::island::geometry::PhysRect;

pub fn capabilities() -> Capabilities {
    Capabilities::none("macos")
}

pub fn prepare_island_window(_window: &WebviewWindow) {}

pub fn show_island_window(window: &WebviewWindow) {
    let _ = window.show();
}

pub fn set_island_region(_window: &WebviewWindow, _rects: &[PhysRect]) {}

pub fn start_system_watch(_handler: impl Fn(super::SystemEvent) + Send + 'static) {}

pub fn watch_webview(
    _window: &WebviewWindow,
    _handler: impl Fn(super::WebviewFailure) + Send + 'static,
) {
}

/// Not implemented yet: a short pause instead of a real wait.
pub fn wait_for_process_exit(_pid: u32, _timeout: std::time::Duration) {
    std::thread::sleep(std::time::Duration::from_secs(1));
}

pub fn start_media(
    _on_update: impl Fn(Option<crate::media::MediaSnapshot>) + Send + 'static,
) -> Option<super::MediaControl> {
    None
}

pub fn file_thumbnail(_path: &std::path::Path, _size: u32) -> Option<Vec<u8>> {
    None
}
