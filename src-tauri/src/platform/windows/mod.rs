//! Windows implementation: the primary target. Features are switched on here
//! as each development step lands and passes its checks.

mod fullscreen;
mod island;
mod process;
mod system_events;
mod webview;

pub use island::{prepare_island_window, set_island_region, show_island_window};
pub use process::wait_for_process_exit;
pub use system_events::start_system_watch;
pub use webview::watch_webview;

use super::Capabilities;

pub fn capabilities() -> Capabilities {
    Capabilities {
        island_window: true,
        ..Capabilities::none("windows")
    }
}
