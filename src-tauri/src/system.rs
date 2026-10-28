//! Reacts to what the system reports (see `platform::SystemEvent`): the
//! island is re-placed when displays change or the session resumes, and the
//! frontend is told when a fullscreen app takes over.

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Emitter, Manager};

use crate::island;
use crate::platform::{self, SystemEvent};

/// Latest fullscreen state, for a frontend that starts (or reloads) late.
static FULLSCREEN: AtomicBool = AtomicBool::new(false);

pub const FULLSCREEN_EVENT: &str = "system://fullscreen";

/// True while a fullscreen app covers the island's monitor.
#[tauri::command]
pub fn get_fullscreen() -> bool {
    FULLSCREEN.load(Ordering::Relaxed)
}

pub fn start(handle: &AppHandle) {
    let handle = handle.clone();
    platform::start_system_watch(move |event| {
        log::info!("system: {event:?}");
        match event {
            SystemEvent::Fullscreen(on) => {
                FULLSCREEN.store(on, Ordering::Relaxed);
                if let Err(e) = handle.emit(FULLSCREEN_EVENT, on) {
                    log::warn!("could not tell the island about fullscreen: {e}");
                }
            }
            SystemEvent::DisplayChanged | SystemEvent::Resumed | SystemEvent::TaskbarCreated => {
                let main = handle.clone();
                let result = handle.run_on_main_thread(move || {
                    if let Some(window) = main.get_webview_window(island::LABEL) {
                        if let Err(e) = island::place(&window) {
                            log::warn!("could not re-place the island: {e}");
                        }
                        platform::prepare_island_window(&window);
                    }
                });
                if let Err(e) = result {
                    log::warn!("could not reach the main thread: {e}");
                }
            }
        }
    });
}
