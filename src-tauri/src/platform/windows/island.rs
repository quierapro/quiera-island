//! Native window behaviour of the island on Windows.
//!
//! - `WS_EX_NOACTIVATE`: clicking the island never takes focus from the app
//!   the user is typing in.
//! - `WS_EX_TOOLWINDOW` (and no `WS_EX_APPWINDOW`): no taskbar button, not in
//!   Alt+Tab.
//! - `WS_EX_LAYERED`: required before a window region is set, otherwise the
//!   region turns the window's transparent pixels opaque.
//! - A window region (`SetWindowRgn`) limits drawing *and* hit-testing to the
//!   pill, so the rest of the window lets clicks through without any global
//!   mouse hook.

use std::ffi::c_void;
use std::sync::atomic::{AtomicIsize, Ordering};

use tauri::WebviewWindow;
use windows::Win32::Foundation::HWND;
use windows::Win32::Graphics::Gdi::{
    CombineRgn, CreateRectRgn, DeleteObject, RGN_OR, SetWindowRgn,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GWL_EXSTYLE, GetWindowLongPtrW, HWND_TOPMOST, SET_WINDOW_POS_FLAGS, SW_SHOWNOACTIVATE,
    SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SetWindowLongPtrW, SetWindowPos,
    ShowWindow, WS_EX_APPWINDOW, WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
};

use crate::island::geometry::PhysRect;

fn hwnd(window: &WebviewWindow) -> Option<HWND> {
    match window.hwnd() {
        Ok(hwnd) => Some(hwnd),
        Err(e) => {
            log::warn!("island window has no HWND: {e}");
            None
        }
    }
}

/// The extended style the island needs, every unrelated bit kept.
fn island_ex_style(current: u32) -> u32 {
    (current | WS_EX_NOACTIVATE.0 | WS_EX_TOOLWINDOW.0 | WS_EX_LAYERED.0) & !WS_EX_APPWINDOW.0
}

/// The island's window, for the system-event thread (0 when there is none).
static ISLAND_HWND: AtomicIsize = AtomicIsize::new(0);

pub fn island_hwnd() -> Option<HWND> {
    match ISLAND_HWND.load(Ordering::Relaxed) {
        0 => None,
        raw => Some(HWND(raw as *mut c_void)),
    }
}

/// Applies the island's extended styles and puts it above other windows,
/// without activating it.
pub fn prepare_island_window(window: &WebviewWindow) {
    let Some(hwnd) = hwnd(window) else { return };
    ISLAND_HWND.store(hwnd.0 as isize, Ordering::Relaxed);
    // SAFETY: `hwnd` belongs to a live window owned by this process.
    unsafe {
        let current = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        let wanted = island_ex_style(current);
        if wanted != current {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, wanted as isize);
        }
        set_topmost(hwnd, SWP_FRAMECHANGED);
    }
}

/// Puts the island back above other topmost windows (Task Manager, players
/// in "always on top"…), and re-stamps its styles: the shell can drop
/// NOACTIVATE or TOOLWINDOW from a topmost window on some Windows builds.
pub fn reassert_topmost() {
    let Some(hwnd) = island_hwnd() else { return };
    // SAFETY: a stale handle only makes these calls fail.
    unsafe {
        let current = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        let wanted = island_ex_style(current);
        if wanted != current {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, wanted as isize);
        }
        set_topmost(hwnd, SET_WINDOW_POS_FLAGS(0));
    }
}

unsafe fn set_topmost(hwnd: HWND, extra: SET_WINDOW_POS_FLAGS) {
    // SAFETY: forwarded from the callers.
    let result = unsafe {
        SetWindowPos(
            hwnd,
            Some(HWND_TOPMOST),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | extra,
        )
    };
    if let Err(e) = result {
        log::warn!("could not make the island topmost: {e}");
    }
}

/// Shows the window without activating it. Tauri's `show()` uses `SW_SHOW`,
/// which would take focus from the foreground app.
pub fn show_island_window(window: &WebviewWindow) {
    let Some(hwnd) = hwnd(window) else { return };
    // SAFETY: `hwnd` belongs to a live window owned by this process.
    unsafe {
        let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
    }
}

/// Sets the window region to the union of `rects` (physical window pixels).
pub fn set_island_region(window: &WebviewWindow, rects: &[PhysRect]) {
    let Some(hwnd) = hwnd(window) else { return };
    // SAFETY: the regions are created and freed here; after a successful
    // SetWindowRgn the system owns `region`, so it is only freed on failure.
    unsafe {
        let region = CreateRectRgn(0, 0, 0, 0);
        for r in rects {
            let part = CreateRectRgn(r.x, r.y, r.x + r.width, r.y + r.height);
            CombineRgn(Some(region), Some(region), Some(part), RGN_OR);
            let _ = DeleteObject(part.into());
        }
        if SetWindowRgn(hwnd, Some(region), true) == 0 {
            log::warn!("SetWindowRgn failed");
            let _ = DeleteObject(region.into());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use windows::Win32::UI::WindowsAndMessaging::WS_EX_TOPMOST;

    #[test]
    fn island_style_adds_what_it_needs_and_drops_appwindow() {
        let style = island_ex_style(WS_EX_APPWINDOW.0 | WS_EX_TOPMOST.0);
        assert_eq!(style & WS_EX_APPWINDOW.0, 0);
        assert_ne!(style & WS_EX_NOACTIVATE.0, 0);
        assert_ne!(style & WS_EX_TOOLWINDOW.0, 0);
        assert_ne!(style & WS_EX_LAYERED.0, 0);
        assert_ne!(style & WS_EX_TOPMOST.0, 0, "unrelated bits are kept");
    }
}
