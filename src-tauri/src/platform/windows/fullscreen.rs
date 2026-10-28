//! Is the foreground app fullscreen on the island's monitor? If so the
//! island steps aside (games, videos, browsers in F11, presentations).
//!
//! The decision is a pure function of a few facts gathered from Win32, so it
//! is unit-tested without any window.

use windows::Win32::Foundation::{HWND, RECT};
use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MONITOR_DEFAULTTONEAREST, MONITOR_DEFAULTTONULL, MONITORINFO,
    MonitorFromWindow,
};
use windows::Win32::System::Threading::GetCurrentProcessId;
use windows::Win32::UI::Shell::{
    QUNS_PRESENTATION_MODE, QUNS_RUNNING_D3D_FULL_SCREEN, SHQueryUserNotificationState,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GWL_EXSTYLE, GetClassNameW, GetDesktopWindow, GetForegroundWindow, GetShellWindow,
    GetWindowLongPtrW, GetWindowRect, GetWindowThreadProcessId, IsZoomed, WS_EX_TOOLWINDOW,
};

/// Facts about the foreground window that the decision needs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Foreground {
    /// It is on the island's monitor and covers all of it.
    pub covers_monitor: bool,
    /// Maximized: a normal window, even when it covers the monitor (auto-hide taskbar).
    pub zoomed: bool,
    /// The desktop, the taskbar, a tool window (Alt+Tab, flyouts) or Quiera itself.
    pub ignored: bool,
}

/// `exclusive`: Windows itself reports an exclusive Direct3D app or
/// presentation mode.
pub fn is_fullscreen(foreground: Option<Foreground>, exclusive: bool) -> bool {
    if exclusive {
        return true;
    }
    foreground.is_some_and(|f| f.covers_monitor && !f.zoomed && !f.ignored)
}

pub fn covers(window: RECT, monitor: RECT) -> bool {
    window.left <= monitor.left
        && window.top <= monitor.top
        && window.right >= monitor.right
        && window.bottom >= monitor.bottom
}

/// Window classes of the shell that may cover the monitor without being an app.
const SHELL_CLASSES: [&str; 4] = [
    "Progman",
    "WorkerW",
    "Shell_TrayWnd",
    "Shell_SecondaryTrayWnd",
];

/// Gathers the facts from Win32 and decides.
pub fn foreground_is_fullscreen(island: HWND) -> bool {
    // SAFETY: plain Win32 queries on window handles; a stale handle only
    // makes them fail, which reads as "not fullscreen".
    unsafe {
        let exclusive = SHQueryUserNotificationState()
            .is_ok_and(|s| s == QUNS_RUNNING_D3D_FULL_SCREEN || s == QUNS_PRESENTATION_MODE);
        let fg = GetForegroundWindow();
        let foreground = (!fg.is_invalid()).then(|| Foreground {
            covers_monitor: covers_island_monitor(fg, island),
            zoomed: IsZoomed(fg).as_bool(),
            ignored: is_ignored(fg),
        });
        is_fullscreen(foreground, exclusive)
    }
}

unsafe fn covers_island_monitor(fg: HWND, island: HWND) -> bool {
    unsafe {
        let monitor = MonitorFromWindow(island, MONITOR_DEFAULTTONEAREST);
        if MonitorFromWindow(fg, MONITOR_DEFAULTTONULL) != monitor {
            return false;
        }
        let mut info = MONITORINFO {
            cbSize: size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        let mut rect = RECT::default();
        GetMonitorInfoW(monitor, &mut info).as_bool()
            && GetWindowRect(fg, &mut rect).is_ok()
            && covers(rect, info.rcMonitor)
    }
}

unsafe fn is_ignored(fg: HWND) -> bool {
    unsafe {
        if fg == GetShellWindow() || fg == GetDesktopWindow() {
            return true;
        }
        let mut pid = 0;
        GetWindowThreadProcessId(fg, Some(&mut pid));
        if pid == GetCurrentProcessId() {
            return true;
        }
        if GetWindowLongPtrW(fg, GWL_EXSTYLE) as u32 & WS_EX_TOOLWINDOW.0 != 0 {
            return true;
        }
        let mut buf = [0u16; 64];
        let len = GetClassNameW(fg, &mut buf) as usize;
        let class = String::from_utf16_lossy(&buf[..len]);
        SHELL_CLASSES.contains(&class.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MONITOR: RECT = RECT {
        left: 0,
        top: 0,
        right: 1920,
        bottom: 1080,
    };

    fn app(covers_monitor: bool, zoomed: bool) -> Option<Foreground> {
        Some(Foreground {
            covers_monitor,
            zoomed,
            ignored: false,
        })
    }

    #[test]
    fn a_borderless_window_covering_the_monitor_is_fullscreen() {
        assert!(is_fullscreen(app(true, false), false));
    }

    #[test]
    fn a_maximized_window_is_not_even_with_an_auto_hide_taskbar() {
        assert!(!is_fullscreen(app(true, true), false));
    }

    #[test]
    fn a_normal_window_is_not() {
        assert!(!is_fullscreen(app(false, false), false));
    }

    #[test]
    fn the_desktop_and_shell_windows_are_not() {
        let desktop = Some(Foreground {
            covers_monitor: true,
            zoomed: false,
            ignored: true,
        });
        assert!(!is_fullscreen(desktop, false));
    }

    #[test]
    fn exclusive_direct3d_or_presentation_mode_always_is() {
        assert!(is_fullscreen(None, true));
        assert!(is_fullscreen(app(false, false), true));
    }

    #[test]
    fn no_foreground_window_is_not() {
        assert!(!is_fullscreen(None, false));
    }

    #[test]
    fn covers_needs_every_edge_at_or_beyond_the_monitor() {
        assert!(covers(MONITOR, MONITOR));
        let bigger = RECT {
            left: -8,
            top: -8,
            right: 1928,
            bottom: 1088,
        };
        assert!(covers(bigger, MONITOR));
        let short = RECT {
            bottom: 1040,
            ..MONITOR
        };
        assert!(!covers(short, MONITOR));
    }
}
