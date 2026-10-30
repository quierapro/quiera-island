//! A background thread that listens to the system for the island:
//!
//! - a hidden top-level window receives display changes, resume from sleep,
//!   session unlock and Explorer restarts (broadcasts skip message-only
//!   windows, so it must be top-level);
//! - WinEvent hooks follow the foreground window to detect fullscreen apps.
//!   Location changes are only watched for the foreground app's process, so
//!   mouse movement elsewhere does not wake the thread.

use std::cell::RefCell;

use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::System::RemoteDesktop::{
    NOTIFY_FOR_THIS_SESSION, WTSRegisterSessionNotification,
};
use windows::Win32::UI::Accessibility::{HWINEVENTHOOK, SetWinEventHook, UnhookWinEvent};
use windows::Win32::UI::WindowsAndMessaging::{
    CHILDID_SELF, CreateWindowExW, DefWindowProcW, DispatchMessageW, EVENT_OBJECT_LOCATIONCHANGE,
    EVENT_SYSTEM_FOREGROUND, GetForegroundWindow, GetMessageW, GetWindowThreadProcessId, KillTimer,
    MSG, OBJID_WINDOW, PBT_APMRESUMEAUTOMATIC, RegisterClassW, RegisterWindowMessageW,
    SPI_SETWORKAREA, SetTimer, TranslateMessage, WINEVENT_OUTOFCONTEXT, WINEVENT_SKIPOWNPROCESS,
    WM_DISPLAYCHANGE, WM_POWERBROADCAST, WM_SETTINGCHANGE, WM_TIMER, WM_WTSSESSION_CHANGE,
    WNDCLASSW, WS_EX_TOOLWINDOW, WS_POPUP, WTS_SESSION_UNLOCK,
};
use windows::core::w;

use super::fullscreen::foreground_is_fullscreen;
use super::island::{island_hwnd, reassert_topmost};
use crate::platform::SystemEvent;

type Handler = Box<dyn Fn(SystemEvent) + Send>;

struct Watch {
    handler: Handler,
    window: HWND,
    taskbar_created: u32,
    /// The fullscreen state last reported.
    fullscreen: Option<bool>,
    /// A different state waiting to settle, its timer running.
    pending: Option<bool>,
    location_hook: Option<HWINEVENTHOOK>,
}

/// The timer that lets a fullscreen change settle before it is reported.
const SETTLE_TIMER: usize = 1;
/// While a game loads or Alt+Tab runs, the foreground flips several times a
/// second: reported at once, the island blinked in and out. A change is
/// reported once it has lasted this long.
const SETTLE_MS: u32 = 300;

thread_local! {
    // Everything below runs on the watcher thread: window procedure and
    // out-of-context WinEvent callbacks are delivered to the thread that
    // registered them.
    static WATCH: RefCell<Option<Watch>> = const { RefCell::new(None) };
}

pub fn start_system_watch(handler: impl Fn(SystemEvent) + Send + 'static) {
    let handler: Handler = Box::new(handler);
    let spawned = std::thread::Builder::new()
        .name("quiera-system-events".into())
        .spawn(move || {
            // SAFETY: Win32 window and hook setup on this thread, which then
            // runs their message loop until the process exits.
            if let Err(e) = unsafe { run(handler) } {
                log::error!("system event watcher stopped: {e}");
            }
        });
    if let Err(e) = spawned {
        log::error!("could not start the system event watcher: {e}");
    }
}

unsafe fn run(handler: Handler) -> windows::core::Result<()> {
    unsafe {
        let instance = GetModuleHandleW(None)?;
        let class = w!("QuieraSystemEvents");
        RegisterClassW(&WNDCLASSW {
            lpfnWndProc: Some(window_proc),
            hInstance: instance.into(),
            lpszClassName: class,
            ..Default::default()
        });
        let hwnd = CreateWindowExW(
            WS_EX_TOOLWINDOW,
            class,
            w!("Quiera system events"),
            WS_POPUP,
            0,
            0,
            0,
            0,
            None,
            None,
            Some(instance.into()),
            None,
        )?;
        if let Err(e) = WTSRegisterSessionNotification(hwnd, NOTIFY_FOR_THIS_SESSION) {
            log::warn!("no session notifications (unlock will not re-place the island): {e}");
        }
        let taskbar_created = RegisterWindowMessageW(w!("TaskbarCreated"));
        WATCH.with_borrow_mut(|w| {
            *w = Some(Watch {
                handler,
                window: hwnd,
                taskbar_created,
                fullscreen: None,
                pending: None,
                location_hook: None,
            })
        });

        let foreground_hook = SetWinEventHook(
            EVENT_SYSTEM_FOREGROUND,
            EVENT_SYSTEM_FOREGROUND,
            None,
            Some(on_win_event),
            0,
            0,
            WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
        );
        if foreground_hook.is_invalid() {
            log::warn!("no foreground hook: fullscreen apps will not hide the island");
        }
        follow_foreground();
        log::info!("system event watcher started");

        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).as_bool() {
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
        Ok(())
    }
}

fn emit(event: SystemEvent) {
    WATCH.with_borrow(|w| {
        if let Some(w) = w {
            (w.handler)(event)
        }
    });
}

/// Re-checks fullscreen. A change is reported once it has held for
/// `SETTLE_MS`, the very first state at once. Returns the state reported,
/// which is what the island follows.
fn check_fullscreen() -> bool {
    let Some(island) = island_hwnd() else {
        return false;
    };
    let now = foreground_is_fullscreen(island);
    let Some((window, reported, pending)) =
        WATCH.with_borrow(|w| w.as_ref().map(|w| (w.window, w.fullscreen, w.pending)))
    else {
        return now;
    };
    match reported {
        None => report_fullscreen(now),
        Some(was) if was == now => {
            // Back where it was: drop the pending change.
            if pending.is_some() {
                set_pending(None);
                // SAFETY: the watcher's own window, on this thread.
                let _ = unsafe { KillTimer(Some(window), SETTLE_TIMER) };
            }
        }
        // Armed once per change, not at every event: a window that keeps
        // moving (a video player) must not hold the change back.
        Some(_) if pending != Some(now) => {
            set_pending(Some(now));
            // SAFETY: as above.
            unsafe { SetTimer(Some(window), SETTLE_TIMER, SETTLE_MS, None) };
        }
        Some(_) => {}
    }
    reported.unwrap_or(now)
}

fn set_pending(state: Option<bool>) {
    WATCH.with_borrow_mut(|w| {
        if let Some(w) = w {
            w.pending = state;
        }
    });
}

/// The settle timer fired: reports the state if it still differs.
fn settle_fullscreen(window: HWND) {
    // SAFETY: the watcher's own window, on this thread.
    let _ = unsafe { KillTimer(Some(window), SETTLE_TIMER) };
    set_pending(None);
    let Some(island) = island_hwnd() else {
        return;
    };
    let now = foreground_is_fullscreen(island);
    if WATCH.with_borrow(|w| w.as_ref().and_then(|w| w.fullscreen)) != Some(now) {
        report_fullscreen(now);
        if !now {
            reassert_topmost();
        }
    }
}

fn report_fullscreen(now: bool) {
    WATCH.with_borrow_mut(|w| {
        if let Some(w) = w {
            w.fullscreen = Some(now);
        }
    });
    emit(SystemEvent::Fullscreen(now));
}

/// The foreground changed: watch the new app's window moves (F11 does not
/// change the foreground), re-check fullscreen, and keep the island above
/// other topmost windows unless it is stepping aside.
fn follow_foreground() {
    // SAFETY: hooks are created and removed on this thread.
    unsafe {
        let fg = GetForegroundWindow();
        let mut pid = 0;
        if !fg.is_invalid() {
            GetWindowThreadProcessId(fg, Some(&mut pid));
        }
        let old = WATCH.with_borrow_mut(|w| w.as_mut().and_then(|w| w.location_hook.take()));
        if let Some(old) = old {
            let _ = UnhookWinEvent(old);
        }
        if pid != 0 {
            let hook = SetWinEventHook(
                EVENT_OBJECT_LOCATIONCHANGE,
                EVENT_OBJECT_LOCATIONCHANGE,
                None,
                Some(on_win_event),
                pid,
                0,
                WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
            );
            if !hook.is_invalid() {
                WATCH.with_borrow_mut(|w| {
                    if let Some(w) = w {
                        w.location_hook = Some(hook)
                    }
                });
            }
        }
    }
    if !check_fullscreen() {
        reassert_topmost();
    }
}

unsafe extern "system" fn on_win_event(
    _hook: HWINEVENTHOOK,
    event: u32,
    hwnd: HWND,
    id_object: i32,
    id_child: i32,
    _thread: u32,
    _time: u32,
) {
    if event == EVENT_SYSTEM_FOREGROUND {
        follow_foreground();
    } else if event == EVENT_OBJECT_LOCATIONCHANGE
        && id_object == OBJID_WINDOW.0
        && id_child == CHILDID_SELF as i32
        // SAFETY: a read-only query.
        && hwnd == unsafe { GetForegroundWindow() }
    {
        check_fullscreen();
    }
}

unsafe extern "system" fn window_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    let taskbar_created = WATCH.with_borrow(|w| w.as_ref().map_or(0, |w| w.taskbar_created));
    match msg {
        WM_DISPLAYCHANGE => {
            emit(SystemEvent::DisplayChanged);
            check_fullscreen();
        }
        WM_SETTINGCHANGE if wparam.0 as u32 == SPI_SETWORKAREA.0 => {
            emit(SystemEvent::DisplayChanged)
        }
        WM_POWERBROADCAST if wparam.0 as u32 == PBT_APMRESUMEAUTOMATIC => {
            emit(SystemEvent::Resumed)
        }
        WM_WTSSESSION_CHANGE if wparam.0 as u32 == WTS_SESSION_UNLOCK => emit(SystemEvent::Resumed),
        WM_TIMER if wparam.0 == SETTLE_TIMER => settle_fullscreen(hwnd),
        m if m != 0 && m == taskbar_created => emit(SystemEvent::TaskbarCreated),
        _ => {}
    }
    // SAFETY: default handling for every message.
    unsafe { DefWindowProcW(hwnd, msg, wparam, lparam) }
}
