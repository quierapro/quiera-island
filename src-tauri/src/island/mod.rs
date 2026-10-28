//! The island window: a transparent, always-on-top surface at the top of the
//! primary monitor. It never takes focus, and outside the region the frontend
//! reports (the drawn pill) clicks go to the windows underneath.

pub mod geometry;

use geometry::{LogicalRect, PhysRect, island_window_rect, region_to_physical};
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

use crate::platform;

pub const LABEL: &str = "island";

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
    platform::show_island_window(&window);
    Ok(())
}

/// Moves and sizes the window for the primary monitor's current scale.
pub fn place(window: &WebviewWindow) -> tauri::Result<()> {
    let Some(monitor) = window.primary_monitor()? else {
        log::warn!("no primary monitor; island left where it is");
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
    log::info!(
        "island placed at {:?} (scale {})",
        rect,
        monitor.scale_factor()
    );
    Ok(())
}

/// Limits drawing and hit-testing to `rects` (CSS pixels of the window).
/// An empty list makes the whole window click-through and invisible.
#[tauri::command]
pub fn set_island_region(window: WebviewWindow, rects: Vec<LogicalRect>) -> Result<(), String> {
    if rects.len() > MAX_REGION_RECTS {
        return Err(format!("too many region rectangles: {}", rects.len()));
    }
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    platform::set_island_region(&window, &region_to_physical(&rects, scale));
    Ok(())
}
