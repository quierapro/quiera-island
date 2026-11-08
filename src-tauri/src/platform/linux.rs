//! Linux: not implemented yet. Compiled in CI so portable code stays portable.

use tauri::WebviewWindow;

use super::Capabilities;
use crate::island::geometry::PhysRect;

pub fn capabilities() -> Capabilities {
    Capabilities::none("linux")
}

pub fn prepare_island_window(_window: &WebviewWindow) {}

pub fn set_island_click_through(_on: bool) {}

pub fn pointer() -> Option<(i32, i32, bool)> {
    None
}

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

pub fn watch_file_drops(
    _window: &WebviewWindow,
    _handler: impl Fn(Vec<std::path::PathBuf>) + Send + 'static,
) {
}

pub fn start_clipboard_watch(_handler: impl Fn(crate::clipboard::ClipContent) + Send + 'static) {}

pub fn write_clipboard(_content: &crate::clipboard::ClipContent) -> Result<(), String> {
    Err("not implemented on this platform yet".into())
}

pub fn start_notification_watch(
    _handler: impl Fn(crate::notifications::NotificationEvent) + Send + 'static,
) {
}

pub fn dismiss_notification(_id: u32) {}

pub fn launch_app(_app_id: &str) -> Result<(), String> {
    Err("not implemented on this platform yet".into())
}

pub fn notifications_quiet() -> bool {
    false
}

pub fn read_controls() -> crate::controls::RawControls {
    crate::controls::RawControls {
        radios: Vec::new(),
        outputs: Vec::new(),
        master: None,
        apps: Vec::new(),
    }
}

const NOT_YET: &str = "not implemented on this platform yet";

pub fn set_radio(_kind: crate::controls::RadioKind, _on: bool) -> Result<(), String> {
    Err(NOT_YET.into())
}

pub fn set_default_output(_id: &str) -> Result<(), String> {
    Err(NOT_YET.into())
}

pub fn set_master_volume(_level: u8) -> Result<(), String> {
    Err(NOT_YET.into())
}

pub fn set_master_mute(_muted: bool) -> Result<(), String> {
    Err(NOT_YET.into())
}

pub fn set_app_volume(_path: &std::path::Path, _level: u8) -> Result<(), String> {
    Err(NOT_YET.into())
}

pub fn set_app_mute(_path: &std::path::Path, _muted: bool) -> Result<(), String> {
    Err(NOT_YET.into())
}

pub fn start_launcher_hotkey(_handler: impl Fn() + Send + 'static) {}

pub fn on_island_hotkey(_handler: impl Fn() + Send + Sync + 'static) {}

pub fn raise_island() {}

pub fn set_island_hotkey(_hotkey: &crate::settings::Hotkey) -> bool {
    false
}

pub fn set_launcher_hotkey(_shortcut: Option<crate::settings::Shortcut>) -> bool {
    false
}

pub fn set_autostart(_enabled: bool) -> Result<(), String> {
    Err("not implemented on this platform yet".into())
}

pub fn focus_island(_window: &WebviewWindow) {}

pub fn restore_focus() {}

pub fn set_webview_memory_low(_window: &WebviewWindow, _low: bool) {}

pub fn lower_thread_priority() {}

pub fn install_crash_logger() {}

/// For now, the home folder only.
pub fn fixed_drives() -> Vec<std::path::PathBuf> {
    std::env::var_os("HOME")
        .map(std::path::PathBuf::from)
        .into_iter()
        .collect()
}

pub fn island_has_focus() -> bool {
    true
}

pub fn list_apps() -> Vec<crate::launcher::LaunchApp> {
    Vec::new()
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

pub fn start_peek_watch(_handler: impl Fn(crate::peeks::SystemPeek) + Send + Sync + 'static) {}

pub fn start_bluetooth_watch(_handler: impl Fn(crate::peeks::SystemPeek) + Send + Sync + 'static) {}

pub fn share_files(_window: &WebviewWindow, _paths: &[std::path::PathBuf]) -> Result<(), String> {
    Err("not implemented on this platform yet".into())
}

pub fn lan_addresses() -> Vec<std::net::Ipv4Addr> {
    Vec::new()
}

/// Whether the system shows itself in French (from LANG / LC_ALL).
pub fn system_prefers_french() -> bool {
    ["LC_ALL", "LC_MESSAGES", "LANG"]
        .iter()
        .find_map(|v| std::env::var(v).ok().filter(|s| !s.is_empty()))
        .is_some_and(|l| l.to_lowercase().starts_with("fr"))
}

pub fn allow_island_camera(_window: &WebviewWindow) {}

/// No agents' channel on this platform yet: nothing is received.
pub fn serve_agent_pipe(
    _handler: impl Fn(String, &dyn Fn() -> bool) -> Option<String> + Send + Sync + 'static,
) {
}

pub fn send_agent_message(_message: &str, _reply: bool) -> Option<String> {
    None
}

pub fn agent_window(_project: &str) -> Option<isize> {
    None
}

pub fn focus_window(_window: isize) -> bool {
    false
}

pub fn window_in_front(_window: isize) -> bool {
    false
}

pub fn process_running(_name: &str) -> bool {
    false
}

pub fn window_title(_window: isize) -> String {
    String::new()
}

pub fn short_path(_path: &str) -> Option<String> {
    None
}

pub fn start_in_terminal(
    _program: &std::path::Path,
    _task: &str,
    _folder: &std::path::Path,
) -> Result<(), String> {
    Err("not implemented on this platform yet".into())
}

pub fn play_system_sound(_alias: &str) {}
