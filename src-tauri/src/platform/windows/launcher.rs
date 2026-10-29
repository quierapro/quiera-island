//! The launcher on Windows: its global shortcut, the apps it can open, and
//! handing the keyboard to the island and back.
//!
//! Apps come from the shell's Applications folder (`shell:AppsFolder`):
//! what the Start menu lists, Store and classic apps alike, each with the id
//! that opens it.

use std::ffi::c_void;
use std::sync::atomic::{AtomicIsize, Ordering};

use tauri::WebviewWindow;
use windows::Win32::Foundation::HWND;
use windows::Win32::Storage::FileSystem::{GetDriveTypeW, GetLogicalDrives};
use windows::Win32::System::Com::{COINIT_APARTMENTTHREADED, CoInitializeEx, CoTaskMemFree};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    HOT_KEY_MODIFIERS, MOD_ALT, MOD_CONTROL, MOD_NOREPEAT, RegisterHotKey, VK_SPACE,
};
use windows::Win32::UI::Shell::{
    BHID_EnumItems, FOLDERID_AppsFolder, IEnumShellItems, IShellItem, KF_FLAG_DEFAULT,
    SHGetKnownFolderItem, SIGDN, SIGDN_NORMALDISPLAY, SIGDN_PARENTRELATIVEPARSING,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetMessageW, IsWindow, MSG, SetForegroundWindow, WM_HOTKEY,
};

use crate::launcher::{LaunchApp, Shortcut};

/// Alt+Space first (as PowerToys Run); Ctrl+Alt+Space when another app holds it.
const SHORTCUTS: [(HOT_KEY_MODIFIERS, Shortcut); 2] = [
    (MOD_ALT, Shortcut::AltSpace),
    (
        HOT_KEY_MODIFIERS(MOD_CONTROL.0 | MOD_ALT.0),
        Shortcut::CtrlAltSpace,
    ),
];

/// Listens for the launcher's shortcut; `handler` runs on each press.
/// Returns the shortcut taken, or None when every one is held elsewhere.
pub fn start_launcher_hotkey(handler: impl Fn() + Send + 'static) -> Option<Shortcut> {
    let (tx, rx) = std::sync::mpsc::channel();
    let spawned = std::thread::Builder::new()
        .name("quiera-launcher-key".into())
        .spawn(move || {
            // SAFETY: a thread hotkey (no window): WM_HOTKEY comes to this
            // thread's queue, read by the loop below.
            unsafe {
                let taken = SHORTCUTS.iter().find_map(|(modifiers, shortcut)| {
                    RegisterHotKey(None, 1, *modifiers | MOD_NOREPEAT, u32::from(VK_SPACE.0))
                        .ok()
                        .map(|()| *shortcut)
                });
                let _ = tx.send(taken);
                if taken.is_none() {
                    return;
                }
                let mut msg = MSG::default();
                while GetMessageW(&mut msg, None, 0, 0).as_bool() {
                    if msg.message == WM_HOTKEY {
                        handler();
                    }
                }
            }
        });
    if let Err(e) = spawned {
        log::error!("could not start the launcher shortcut: {e}");
        return None;
    }
    rx.recv().ok().flatten()
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
