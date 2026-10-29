//! Applies settings as they change, and at start. What modules read on
//! each use (peek kinds, lyrics source…) needs nothing here: they ask
//! `settings::get()` when it matters.

use tauri::{AppHandle, Manager};

use crate::settings::{self, Settings};
use crate::{clipboard, files, island, launcher, notifications, platform, shelf};

/// What only needs doing once settings are loaded.
pub fn at_start(app: &AppHandle) {
    // The path may have moved (an update, another folder): written again.
    if settings::get().general.start_with_windows
        && let Err(e) = platform::set_autostart(true)
    {
        log::warn!("{e}");
    }
    shelf::restore(app);
}

pub fn changed(app: &AppHandle, previous: &Settings, now: &Settings) {
    if previous.general.start_with_windows != now.general.start_with_windows
        && let Err(e) = platform::set_autostart(now.general.start_with_windows)
    {
        log::warn!("{e}");
    }
    if previous.general.screen != now.general.screen
        && let Some(window) = app.get_webview_window(island::LABEL)
        && let Err(e) = island::place(&window)
    {
        log::warn!("could not move the island: {e}");
    }
    if previous.launcher.enabled != now.launcher.enabled
        || previous.launcher.shortcut != now.launcher.shortcut
    {
        launcher::apply_shortcut();
    }
    if previous.launcher.index_files != now.launcher.index_files {
        if now.launcher.index_files {
            files::refresh();
        } else {
            files::clear();
        }
    }
    if previous.clipboard.enabled && !now.clipboard.enabled {
        clipboard::clear_all(app);
    }
    if previous.notifications.enabled && !now.notifications.enabled {
        notifications::clear_all(app);
    }
    if previous.shelf.keep != now.shelf.keep {
        shelf::persist(app);
    }
}
