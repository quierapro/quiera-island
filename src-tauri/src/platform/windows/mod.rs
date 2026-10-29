//! Windows implementation: the primary target. Features are switched on here
//! as each development step lands and passes its checks.

mod clipboard;
mod controls;
mod crash;
mod file_drop;
mod fullscreen;
mod island;
mod launcher;
mod media;
mod notifications;
mod peeks;
mod process;
mod system_events;
mod thumbnail;
mod webview;

pub use clipboard::{start_clipboard_watch, write_clipboard};
pub use controls::{
    read_controls, set_app_mute, set_app_volume, set_default_output, set_master_mute,
    set_master_volume, set_radio,
};
pub use crash::install_crash_logger;
pub use file_drop::watch_file_drops;
pub use island::{prepare_island_window, set_island_region, show_island_window};
pub use launcher::{
    fixed_drives, focus_island, island_has_focus, list_apps, restore_focus, start_launcher_hotkey,
};
pub use media::start_media;
pub use notifications::{
    dismiss_notification, launch_app, notifications_quiet, start_notification_watch,
};
pub use peeks::start_peek_watch;
pub use process::wait_for_process_exit;
pub use system_events::start_system_watch;
pub use thumbnail::file_thumbnail;
pub use webview::watch_webview;

use super::Capabilities;

pub fn capabilities() -> Capabilities {
    Capabilities {
        island_window: true,
        media: true,
        ..Capabilities::none("windows")
    }
}
