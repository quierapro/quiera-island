//! Windows implementation: the primary target. Features are switched on here
//! as each development step lands and passes its checks.

mod clipboard;
mod file_drop;
mod fullscreen;
mod island;
mod media;
mod peeks;
mod process;
mod system_events;
mod thumbnail;
mod webview;

pub use clipboard::{start_clipboard_watch, write_clipboard};
pub use file_drop::watch_file_drops;
pub use island::{prepare_island_window, set_island_region, show_island_window};
pub use media::start_media;
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
