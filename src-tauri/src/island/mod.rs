//! The island window: a transparent, always-on-top surface at the top of the
//! primary monitor. It never takes focus, and outside the region the frontend
//! reports (the drawn pill) clicks go to the windows underneath.

pub mod geometry;
pub mod passthrough;

use geometry::{LogicalRect, PhysRect, island_window_rect, region_to_physical};
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

use crate::platform;

pub const LABEL: &str = "island";
/// The island's shortcut was pressed: the interface shows or hides it.
pub const TOGGLE_EVENT: &str = "island://toggle";

/// Large enough for the biggest expanded state plus shadow and flares
/// (docs/02-decisions-design-fonctionnalites.md §3.4).
const LOGICAL_SIZE: (f64, f64) = (680.0, 380.0);

/// The frontend sends a handful of rectangles; anything beyond this is a bug.
const MAX_REGION_RECTS: usize = 16;

/// Places the island window, applies its native styles and shows it.
pub fn setup(handle: &AppHandle) -> tauri::Result<()> {
    let window = handle
        .get_webview_window(LABEL)
        .expect("the island window is declared in tauri.conf.json");
    place(&window)?;
    platform::prepare_island_window(&window);
    platform::allow_island_camera(&window);
    platform::show_island_window(&window);
    Ok(())
}

/// The monitor the settings name, or the primary one (also when the named
/// one is unplugged).
fn chosen_monitor(window: &WebviewWindow) -> tauri::Result<Option<tauri::Monitor>> {
    if let Some(name) = crate::settings::get().general.screen {
        let named = window
            .available_monitors()?
            .into_iter()
            .find(|m| m.name().is_some_and(|n| *n == name));
        if named.is_some() {
            return Ok(named);
        }
    }
    window.primary_monitor()
}

/// Moves and sizes the window for the chosen monitor's current scale.
pub fn place(window: &WebviewWindow) -> tauri::Result<()> {
    let Some(monitor) = chosen_monitor(window)? else {
        log::warn!("no monitor; island left where it is");
        return Ok(());
    };
    let (pos, size) = (monitor.position(), monitor.size());
    let rect = island_window_rect(
        PhysRect {
            x: pos.x,
            y: pos.y,
            width: size.width as i32,
            height: size.height as i32,
        },
        monitor.scale_factor(),
        LOGICAL_SIZE,
    );
    window.set_size(PhysicalSize::new(rect.width as u32, rect.height as u32))?;
    window.set_position(PhysicalPosition::new(rect.x, rect.y))?;
    passthrough::remember_origin(rect.x, rect.y);
    log::info!(
        "island placed at {:?} (scale {})",
        rect,
        monitor.scale_factor()
    );
    Ok(())
}

/// The island's shortcut shows and hides it (over a game in fullscreen,
/// where it hides by itself). Held by the launcher's shortcut thread.
pub fn start_shortcut(app: &AppHandle) {
    let app = app.clone();
    platform::on_island_hotkey(move || {
        use tauri::Emitter;
        // A fullscreen game can sit above other topmost windows.
        platform::raise_island();
        let _ = app.emit(TOGGLE_EVENT, ());
    });
    apply_shortcut();
}

/// Whether Windows gave the island's shortcut (false: another app holds it).
static SHORTCUT_HELD: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(true);

/// Holds the shortcut the settings ask for (none when there is none).
pub fn apply_shortcut() {
    let wanted = crate::settings::get().general.island_shortcut;
    let held = platform::set_island_hotkey(&wanted) || wanted.is_none();
    if !held {
        log::warn!("the island's shortcut is taken by another app");
    }
    SHORTCUT_HELD.store(held, std::sync::atomic::Ordering::Relaxed);
}

/// Whether the island's shortcut works (another app may hold it).
#[tauri::command]
pub fn island_shortcut_held() -> bool {
    SHORTCUT_HELD.load(std::sync::atomic::Ordering::Relaxed)
}

/// While a new shortcut is recorded, the current one lets its keys through.
#[tauri::command]
pub fn island_shortcut_recording(recording: bool) {
    if recording {
        platform::set_island_hotkey(&crate::settings::Hotkey::none());
    } else {
        apply_shortcut();
    }
}

/// Asks the web view to keep its memory low while the island is closed.
#[tauri::command]
pub fn island_memory(window: WebviewWindow, low: bool) {
    platform::set_webview_memory_low(&window, low);
}

/// Mirrors `Monitor` in `src/ipc/settings.ts`.
#[derive(Debug, Clone, serde::Serialize)]
pub struct MonitorInfo {
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub primary: bool,
}

/// The monitors the island can go on.
#[tauri::command]
pub fn settings_monitors(app: AppHandle) -> Vec<MonitorInfo> {
    let Some(window) = app.get_webview_window(LABEL) else {
        return Vec::new();
    };
    let primary = window
        .primary_monitor()
        .ok()
        .flatten()
        .and_then(|m| m.name().cloned());
    window
        .available_monitors()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|m| {
            let name = m.name()?.clone();
            Some(MonitorInfo {
                primary: primary.as_ref() == Some(&name),
                width: m.size().width,
                height: m.size().height,
                name,
            })
        })
        .collect()
}

/// Limits drawing and hit-testing to `rects` (CSS pixels of the window).
/// An empty list makes the whole window click-through and invisible.
#[tauri::command]
pub fn set_island_region(window: WebviewWindow, rects: Vec<LogicalRect>) -> Result<(), String> {
    if rects.len() > MAX_REGION_RECTS {
        return Err(format!("too many region rectangles: {}", rects.len()));
    }
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let rects = region_to_physical(&rects, scale);
    passthrough::remember_shape(&rects);
    platform::set_island_region(&window, &rects);
    Ok(())
}
