//! The launcher on Windows: its global shortcut, the apps it can open, and
//! handing the keyboard to the island and back.
//!
//! Apps come from the shell's Applications folder (`shell:AppsFolder`):
//! what the Start menu lists, Store and classic apps alike, each with the id
//! that opens it.

use std::ffi::c_void;
use std::sync::Mutex;
use std::sync::atomic::{AtomicIsize, Ordering};
use std::sync::mpsc::{self, Sender};
use std::time::Duration;

use tauri::WebviewWindow;
use windows::Win32::Foundation::{HWND, LPARAM, WPARAM};
use windows::Win32::Storage::FileSystem::{GetDriveTypeW, GetLogicalDrives};
use windows::Win32::System::Com::{COINIT_APARTMENTTHREADED, CoInitializeEx, CoTaskMemFree};
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    HOT_KEY_MODIFIERS, MOD_ALT, MOD_CONTROL, MOD_NOREPEAT, MOD_SHIFT, RegisterHotKey,
    UnregisterHotKey, VK_SPACE,
};
use windows::Win32::UI::Shell::{
    BHID_EnumItems, FOLDERID_AppsFolder, IEnumShellItems, IShellItem, KF_FLAG_DEFAULT,
    SHGetKnownFolderItem, SIGDN, SIGDN_NORMALDISPLAY, SIGDN_PARENTRELATIVEPARSING,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetMessageW, IsWindow, MSG, PM_NOREMOVE, PeekMessageW, PostThreadMessageW,
    SetForegroundWindow, WM_APP, WM_HOTKEY,
};

use crate::launcher::LaunchApp;
use crate::settings::Shortcut;

/// The keys of each shortcut.
fn keys(shortcut: Shortcut) -> (HOT_KEY_MODIFIERS, u32) {
    let space = u32::from(VK_SPACE.0);
    match shortcut {
        Shortcut::AltSpace => (MOD_ALT, space),
        Shortcut::CtrlAltSpace => (HOT_KEY_MODIFIERS(MOD_CONTROL.0 | MOD_ALT.0), space),
        Shortcut::CtrlShiftSpace => (HOT_KEY_MODIFIERS(MOD_CONTROL.0 | MOD_SHIFT.0), space),
        Shortcut::AltQ => (MOD_ALT, u32::from(b'Q')),
    }
}

/// A change for the shortcut's thread: the shortcut to hold (None: none)
/// and where to answer whether Windows gave it.
type Request = (Option<Shortcut>, Sender<bool>);

/// The shortcut thread: its request channel and its id, to wake it.
static THREAD: Mutex<Option<(Sender<Request>, u32)>> = Mutex::new(None);

/// Starts the thread that holds the launcher's shortcut; `handler` runs on
/// each press. It holds none until `set_launcher_hotkey` says which.
pub fn start_launcher_hotkey(handler: impl Fn() + Send + 'static) {
    let (ready_tx, ready_rx) = mpsc::channel();
    let spawned = std::thread::Builder::new()
        .name("quiera-launcher-key".into())
        .spawn(move || {
            let (tx, rx) = mpsc::channel::<Request>();
            // SAFETY: a thread hotkey (no window): WM_HOTKEY and the wake-up
            // message come to this thread's queue, read by the loop below.
            unsafe {
                // Creates the queue before anyone posts to it.
                let mut msg = MSG::default();
                let _ = PeekMessageW(&mut msg, None, 0, 0, PM_NOREMOVE);
                *THREAD.lock().unwrap_or_else(|e| e.into_inner()) =
                    Some((tx, GetCurrentThreadId()));
                let _ = ready_tx.send(());
                while GetMessageW(&mut msg, None, 0, 0).as_bool() {
                    match msg.message {
                        WM_HOTKEY => handler(),
                        WM_APP => {
                            for (shortcut, answer) in rx.try_iter() {
                                let _ = UnregisterHotKey(None, 1);
                                let held = shortcut.is_none_or(|s| {
                                    let (modifiers, key) = keys(s);
                                    RegisterHotKey(None, 1, modifiers | MOD_NOREPEAT, key).is_ok()
                                });
                                let _ = answer.send(held);
                            }
                        }
                        _ => {}
                    }
                }
            }
        });
    if let Err(e) = spawned {
        log::error!("could not start the launcher shortcut: {e}");
        return;
    }
    let _ = ready_rx.recv_timeout(Duration::from_secs(2));
}

/// Holds `shortcut` (or none). False when another app already holds it.
pub fn set_launcher_hotkey(shortcut: Option<Shortcut>) -> bool {
    let Some((tx, thread)) = THREAD.lock().unwrap_or_else(|e| e.into_inner()).clone() else {
        return false;
    };
    let (answer_tx, answer_rx) = mpsc::channel();
    if tx.send((shortcut, answer_tx)).is_err() {
        return false;
    }
    // SAFETY: wakes the shortcut thread, which reads the request.
    if unsafe { PostThreadMessageW(thread, WM_APP, WPARAM(0), LPARAM(0)) }.is_err() {
        return false;
    }
    answer_rx
        .recv_timeout(Duration::from_secs(2))
        .unwrap_or(false)
}

/// The window that had the keyboard before the launcher took it.
static PREVIOUS: AtomicIsize = AtomicIsize::new(0);

/// Gives the keyboard to the island, remembering who had it.
/// Called on the shortcut's own thread: Windows lets the process that just
/// received the key take the foreground, so it is done right away.
pub fn focus_island(window: &WebviewWindow) {
    // SAFETY: foreground queries and a request for our own window.
    unsafe {
        let previous = GetForegroundWindow();
        PREVIOUS.store(previous.0 as isize, Ordering::Relaxed);
        if let Some(island) = super::island::island_hwnd() {
            let _ = SetForegroundWindow(island);
        }
    }
    // Then the web view inside it gets the keyboard.
    if let Err(e) = window.set_focus() {
        log::warn!("could not focus the launcher: {e}");
    }
}

/// Whether the island has the keyboard.
pub fn island_has_focus() -> bool {
    // SAFETY: a read-only query.
    let foreground = unsafe { GetForegroundWindow() };
    super::island::island_hwnd().is_some_and(|island| island == foreground)
}

/// Hands the keyboard back to the window that had it.
pub fn restore_focus() {
    let previous = PREVIOUS.swap(0, Ordering::Relaxed);
    if previous == 0 {
        return;
    }
    let hwnd = HWND(previous as *mut c_void);
    // SAFETY: a stale handle is checked first; the call only fails then.
    unsafe {
        if IsWindow(Some(hwnd)).as_bool() {
            let _ = SetForegroundWindow(hwnd);
        }
    }
}

fn display_name(item: &IShellItem, kind: SIGDN) -> Option<String> {
    // SAFETY: the shell allocates the string; it is copied, then freed.
    unsafe {
        let raw = item.GetDisplayName(kind).ok()?;
        let text = raw.to_string().ok();
        CoTaskMemFree(Some(raw.0 as *const _));
        text
    }
}

/// The fixed drives (C:\, D:\…): what the file index walks. Removable,
/// network and optical drives are left out.
pub fn fixed_drives() -> Vec<std::path::PathBuf> {
    // `DRIVE_FIXED`, as GetDriveTypeW reports it.
    const DRIVE_FIXED: u32 = 3;
    // SAFETY: plain queries on drive letters.
    let mask = unsafe { GetLogicalDrives() };
    (0..26u8)
        .filter(|i| mask & (1 << i) != 0)
        .map(|i| format!("{}:\\", char::from(b'A' + i)))
        .filter(|root| {
            let wide = windows::core::HSTRING::from(root.as_str());
            // SAFETY: a query on a drive root.
            (unsafe { GetDriveTypeW(&wide) }) == DRIVE_FIXED
        })
        .map(std::path::PathBuf::from)
        .collect()
}

/// Every app of the Applications folder, with the id that opens it.
pub fn list_apps() -> Vec<LaunchApp> {
    // The shell wants a single-threaded apartment: a thread of its own.
    std::thread::spawn(|| {
        // SAFETY: COM for this short-lived thread; shell enumeration only.
        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
            let Ok(folder) =
                SHGetKnownFolderItem::<IShellItem>(&FOLDERID_AppsFolder, KF_FLAG_DEFAULT, None)
            else {
                return Vec::new();
            };
            let Ok(items) = folder.BindToHandler::<_, IEnumShellItems>(None, &BHID_EnumItems)
            else {
                return Vec::new();
            };
            let mut apps = Vec::new();
            loop {
                let mut batch = [None];
                let mut fetched = 0;
                if items.Next(&mut batch, Some(&mut fetched)).is_err() || fetched == 0 {
                    break;
                }
                let Some(item) = batch[0].take() else { break };
                if let (Some(name), Some(id)) = (
                    display_name(&item, SIGDN_NORMALDISPLAY),
                    display_name(&item, SIGDN_PARENTRELATIVEPARSING),
                ) {
                    apps.push(LaunchApp { name, id });
                }
            }
            apps
        }
    })
    .join()
    .unwrap_or_default()
}
