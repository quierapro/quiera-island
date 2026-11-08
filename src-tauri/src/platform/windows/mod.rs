//! Windows implementation: the primary target. Features are switched on here
//! as each development step lands and passes its checks.

mod agent_pipe;
mod agent_window;
mod autostart;
mod bluetooth;
mod clipboard;
mod controls;
mod crash;
mod file_drop;
mod fullscreen;
mod island;
mod key_tap;
mod language;
mod launcher;
mod media;
mod network;
mod notifications;
mod peeks;
mod process;
mod share;
mod sound;
mod system_events;
mod thumbnail;
mod webview;

pub use agent_pipe::{send_agent_message, serve_agent_pipe};
pub use agent_window::{
    agent_window, focus_window, process_running, short_path, window_in_front, window_title,
};
pub use autostart::set_autostart;
pub use bluetooth::start_bluetooth_watch;
pub use clipboard::{start_clipboard_watch, write_clipboard};
pub use controls::{
    read_controls, set_app_mute, set_app_volume, set_default_output, set_master_mute,
    set_master_volume, set_radio,
};
pub use crash::install_crash_logger;
pub use file_drop::watch_file_drops;
pub use island::reassert_topmost as raise_island;
pub use island::{
    pointer, prepare_island_window, set_island_click_through, set_island_region, show_island_window,
};
pub use language::system_prefers_french;
pub use launcher::{
    fixed_drives, focus_island, island_has_focus, list_apps, on_island_hotkey, restore_focus,
    set_island_hotkey, set_launcher_hotkey, start_launcher_hotkey,
};
pub use media::start_media;
pub use network::lan_addresses;
pub use notifications::{
    dismiss_notification, launch_app, notifications_quiet, start_notification_watch,
};
pub use peeks::start_peek_watch;
pub use process::{lower_thread_priority, start_in_terminal, wait_for_process_exit};
pub use share::share_files;
pub use sound::play_system_sound;
pub use system_events::start_system_watch;
pub use thumbnail::file_thumbnail;
pub use webview::{allow_island_camera, set_webview_memory_low, watch_webview};

use super::Capabilities;

pub fn capabilities() -> Capabilities {
    Capabilities {
        island_window: true,
        media: true,
        ..Capabilities::none("windows")
    }
}
