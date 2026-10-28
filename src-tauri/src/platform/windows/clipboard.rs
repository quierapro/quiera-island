//! The clipboard on Windows: a message-only window listens for changes
//! (`AddClipboardFormatListener`), and arboard reads and writes text and
//! images.
//!
//! What apps mark as private is never read: password managers flag their
//! copies with `ExcludeClipboardContentFromMonitorProcessing` or
//! `CanIncludeInClipboardHistory` = 0, the same signals Windows' own
//! clipboard history (Win+V) honours.

use std::borrow::Cow;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Mutex, OnceLock};

use windows::Win32::Foundation::{HANDLE, HGLOBAL, HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::System::DataExchange::{
    AddClipboardFormatListener, CloseClipboard, GetClipboardData, GetClipboardSequenceNumber,
    IsClipboardFormatAvailable, OpenClipboard, RegisterClipboardFormatW,
};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::System::Memory::{GlobalLock, GlobalSize, GlobalUnlock};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DispatchMessageW, GetMessageW, HWND_MESSAGE, KillTimer, MSG,
    RegisterClassW, SetTimer, TranslateMessage, WINDOW_EX_STYLE, WM_CLIPBOARDUPDATE, WM_TIMER,
    WNDCLASSW, WS_POPUP,
};
use windows::core::{PCWSTR, w};

use crate::clipboard::ClipContent;
use crate::shelf::Rgba;

type Handler = Box<dyn Fn(ClipContent) + Send>;

/// Apps often write a copy in several steps: read once it has settled.
const SETTLE_TIMER: usize = 1;
const SETTLE_MS: u32 = 120;

static HANDLER: OnceLock<Mutex<Handler>> = OnceLock::new();
/// The clipboard's sequence number after Quiera's own write: that change is
/// not a new copy.
static OWN_WRITE: AtomicU32 = AtomicU32::new(0);
/// The last sequence number read, so one change is reported once.
static LAST_SEEN: AtomicU32 = AtomicU32::new(0);

pub fn start_clipboard_watch(handler: impl Fn(ClipContent) + Send + 'static) {
    if HANDLER.set(Mutex::new(Box::new(handler))).is_err() {
        return;
    }
    let spawned = std::thread::Builder::new()
        .name("quiera-clipboard".into())
        .spawn(|| {
            // SAFETY: the window and its loop live on this thread.
            if let Err(e) = unsafe { run_window() } {
                log::error!("clipboard watcher stopped: {e}");
            }
        });
    if let Err(e) = spawned {
        log::error!("could not start the clipboard watcher: {e}");
    }
}

unsafe fn run_window() -> windows::core::Result<()> {
    unsafe {
        let instance = GetModuleHandleW(None)?;
        let class = w!("QuieraClipboard");
        RegisterClassW(&WNDCLASSW {
            lpfnWndProc: Some(window_proc),
            hInstance: instance.into(),
            lpszClassName: class,
            ..Default::default()
        });
        let hwnd = CreateWindowExW(
            WINDOW_EX_STYLE::default(),
            class,
            w!("Quiera clipboard"),
            WS_POPUP,
            0,
            0,
            0,
            0,
            Some(HWND_MESSAGE),
            None,
            Some(instance.into()),
            None,
        )?;
        AddClipboardFormatListener(hwnd)?;
        // What is on the clipboard at start is not a new copy.
        LAST_SEEN.store(GetClipboardSequenceNumber(), Ordering::Relaxed);
        log::info!("clipboard watcher started");
        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).as_bool() {
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
        Ok(())
    }
}

unsafe extern "system" fn window_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    match msg {
        WM_CLIPBOARDUPDATE => {
            // SAFETY: a timer on this window; resetting it delays the read.
            unsafe { SetTimer(Some(hwnd), SETTLE_TIMER, SETTLE_MS, None) };
            return LRESULT(0);
        }
        WM_TIMER if wparam.0 == SETTLE_TIMER => {
            // SAFETY: the timer set above.
            let _ = unsafe { KillTimer(Some(hwnd), SETTLE_TIMER) };
            read_change(hwnd);
            return LRESULT(0);
        }
        _ => {}
    }
    // SAFETY: default handling for every other message.
    unsafe { DefWindowProcW(hwnd, msg, wparam, lparam) }
}

fn read_change(hwnd: HWND) {
    // SAFETY: a read-only query.
    let sequence = unsafe { GetClipboardSequenceNumber() };
    if LAST_SEEN.swap(sequence, Ordering::Relaxed) == sequence
        || OWN_WRITE.load(Ordering::Relaxed) == sequence
        || is_private(hwnd)
    {
        return;
    }
    let Some(content) = read_content() else {
        return;
    };
    if let Some(handler) = HANDLER.get()
        && let Ok(handler) = handler.lock()
    {
        handler(content);
    }
}

fn format(name: PCWSTR) -> u32 {
    // SAFETY: registers (or looks up) a named format.
    unsafe { RegisterClipboardFormatW(name) }
}

/// Whether the app that copied asked to stay out of clipboard monitors.
fn is_private(hwnd: HWND) -> bool {
    let available = |f: u32| f != 0 && unsafe { IsClipboardFormatAvailable(f) }.is_ok();
    if available(format(w!("ExcludeClipboardContentFromMonitorProcessing")))
        || available(format(w!("Clipboard Viewer Ignore")))
    {
        return true;
    }
    let history = format(w!("CanIncludeInClipboardHistory"));
    if !available(history) {
        return false;
    }
    // Present: its DWORD says whether history may keep it. Unreadable counts
    // as private.
    read_dword(hwnd, history).is_none_or(|allowed| allowed == 0)
}

fn read_dword(hwnd: HWND, format: u32) -> Option<u32> {
    // SAFETY: the clipboard is opened, read and closed on this thread; the
    // global memory is locked only while copied.
    unsafe {
        let mut opened = false;
        for _ in 0..5 {
            if OpenClipboard(Some(hwnd)).is_ok() {
                opened = true;
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(20));
        }
        if !opened {
            return None;
        }
        let value = GetClipboardData(format).ok().and_then(|data: HANDLE| {
            let global = HGLOBAL(data.0);
            if GlobalSize(global) < 4 {
                return None;
            }
            let ptr = GlobalLock(global) as *const u32;
            let value = (!ptr.is_null()).then(|| ptr.read_unaligned());
            let _ = GlobalUnlock(global);
            value
        });
        let _ = CloseClipboard();
        value
    }
}

fn read_content() -> Option<ClipContent> {
    let mut clipboard = arboard::Clipboard::new().ok()?;
    if let Ok(text) = clipboard.get_text()
        && !text.trim().is_empty()
    {
        return Some(ClipContent::Text(text));
    }
    let image = clipboard.get_image().ok()?;
    Some(ClipContent::Image(Rgba {
        width: u32::try_from(image.width).ok()?,
        height: u32::try_from(image.height).ok()?,
        pixels: image.bytes.into_owned(),
    }))
}

/// Puts an item back on the clipboard. The change it causes is not
/// reported as a new copy.
pub fn write_clipboard(content: &ClipContent) -> Result<(), String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    let result = match content {
        ClipContent::Text(text) => clipboard.set_text(text.as_str()),
        ClipContent::Image(image) => clipboard.set_image(arboard::ImageData {
            width: image.width as usize,
            height: image.height as usize,
            bytes: Cow::Borrowed(&image.pixels),
        }),
    };
    // SAFETY: a read-only query.
    OWN_WRITE.store(unsafe { GetClipboardSequenceNumber() }, Ordering::Relaxed);
    result.map_err(|e| e.to_string())
}
