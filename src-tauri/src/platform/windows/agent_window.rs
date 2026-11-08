//! Which window an AI agent runs in (a terminal, VS Code), so a click on
//! the island brings it back; and whether its user is looking at it.
//!
//! Found from the hook, a child of the agent: the console the agent is
//! attached to (a classic console, or Windows Terminal's tab), else the
//! first ancestor process with a window of its own (VS Code and its forks).

use std::ffi::c_void;

use windows::Win32::Foundation::{CloseHandle, HWND, LPARAM};
use windows::Win32::Storage::FileSystem::GetShortPathNameW;
use windows::Win32::System::Console::{AttachConsole, FreeConsole, GetConsoleWindow};
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, PROCESSENTRY32W, Process32FirstW, Process32NextW, TH32CS_SNAPPROCESS,
};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GA_ROOTOWNER, GW_OWNER, GetAncestor, GetForegroundWindow, GetWindow,
    GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindow,
    IsWindowVisible, SW_RESTORE, SetForegroundWindow, ShowWindow,
};
use windows::core::{BOOL, HSTRING};

/// Ancestors looked at, at most: hook → agent → shell → terminal…
const MAX_DEPTH: usize = 8;
/// Processes whose windows are never an agent's: the desktop, the taskbar.
const NOT_A_HOST: [&str; 3] = ["explorer.exe", "sihost.exe", "svchost.exe"];

struct Process {
    pid: u32,
    parent: u32,
    name: String,
}

fn processes() -> Vec<Process> {
    let mut list = Vec::new();
    // SAFETY: a snapshot walked with a correctly sized entry, then closed.
    unsafe {
        let Ok(snapshot) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else {
            return list;
        };
        let mut entry = PROCESSENTRY32W {
            dwSize: size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        let mut more = Process32FirstW(snapshot, &mut entry).is_ok();
        while more {
            let len = entry
                .szExeFile
                .iter()
                .position(|&c| c == 0)
                .unwrap_or(entry.szExeFile.len());
            list.push(Process {
                pid: entry.th32ProcessID,
                parent: entry.th32ParentProcessID,
                name: String::from_utf16_lossy(&entry.szExeFile[..len]).to_lowercase(),
            });
            more = Process32NextW(snapshot, &mut entry).is_ok();
        }
        let _ = CloseHandle(snapshot);
    }
    list
}

/// A path's short form (`D:\NOMATR~1\…`), without spaces where the volume
/// keeps short names; None when it has none, or the path does not exist.
pub fn short_path(path: &str) -> Option<String> {
    let wide = HSTRING::from(path);
    // SAFETY: asks for the size, then fills a buffer of that size.
    unsafe {
        let size = GetShortPathNameW(&wide, None);
        if size == 0 {
            return None;
        }
        let mut buffer = vec![0u16; size as usize];
        let len = GetShortPathNameW(&wide, Some(&mut buffer));
        (len > 0 && (len as usize) < buffer.len())
            .then(|| String::from_utf16_lossy(&buffer[..len as usize]))
    }
}

/// Whether a process of this name (`claude.exe`) is running.
pub fn process_running(name: &str) -> bool {
    let name = name.to_lowercase();
    processes().iter().any(|p| p.name == name)
}

/// The ancestors of this process, nearest first.
fn ancestors(list: &[Process]) -> Vec<&Process> {
    let mut chain = Vec::new();
    let mut pid = std::process::id();
    while chain.len() < MAX_DEPTH {
        let Some(me) = list.iter().find(|p| p.pid == pid) else {
            break;
        };
        let Some(parent) = list.iter().find(|p| p.pid == me.parent) else {
            break;
        };
        // A loop (process numbers are reused) ends the walk.
        if parent.pid == 0 || chain.iter().any(|p: &&Process| p.pid == parent.pid) {
            break;
        }
        chain.push(parent);
        pid = parent.pid;
    }
    chain
}

/// A visible window, or the visible window that owns it (Windows
/// Terminal's tabs have an invisible console window owned by the terminal).
fn shown(hwnd: HWND) -> Option<HWND> {
    // SAFETY: read-only queries on a window handle.
    unsafe {
        if hwnd.is_invalid() {
            return None;
        }
        if IsWindowVisible(hwnd).as_bool() {
            return Some(GetAncestor(hwnd, GA_ROOTOWNER))
                .filter(|h| !h.is_invalid())
                .or(Some(hwnd));
        }
        let owner = GetWindow(hwnd, GW_OWNER).ok().filter(|h| !h.is_invalid())?;
        let root = GetAncestor(owner, GA_ROOTOWNER);
        let root = if root.is_invalid() { owner } else { root };
        IsWindowVisible(root).as_bool().then_some(root)
    }
}

/// The console window of process `pid`, if it has one.
fn console_of(pid: u32) -> Option<HWND> {
    // SAFETY: this process leaves its own console (the hook needs none),
    // borrows the other's for one query, and leaves it.
    unsafe {
        let _ = FreeConsole();
        if AttachConsole(pid).is_err() {
            return None;
        }
        let window = GetConsoleWindow();
        let _ = FreeConsole();
        shown(window)
    }
}

/// A window's title (development aid: tests check the window found).
pub fn window_title(window: isize) -> String {
    title(hwnd(window))
}

fn title(hwnd: HWND) -> String {
    // SAFETY: the buffer is sized from the window's own length.
    unsafe {
        let len = GetWindowTextLengthW(hwnd);
        if len <= 0 {
            return String::new();
        }
        let mut buffer = vec![0u16; len as usize + 1];
        let read = GetWindowTextW(hwnd, &mut buffer);
        String::from_utf16_lossy(&buffer[..read as usize])
    }
}

/// The visible, unowned, titled windows of process `pid`.
fn windows_of(pid: u32) -> Vec<HWND> {
    struct Search {
        pid: u32,
        found: Vec<HWND>,
    }
    unsafe extern "system" fn each(hwnd: HWND, data: LPARAM) -> BOOL {
        // SAFETY: `data` is the `Search` below, alive for the whole enumeration.
        let search = unsafe { &mut *(data.0 as *mut Search) };
        let mut pid = 0u32;
        // SAFETY: read-only queries on the window being enumerated.
        unsafe {
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
            if pid == search.pid
                && IsWindowVisible(hwnd).as_bool()
                && GetWindow(hwnd, GW_OWNER).map_or(true, |o| o.is_invalid())
                && GetWindowTextLengthW(hwnd) > 0
            {
                search.found.push(hwnd);
            }
        }
        true.into()
    }
    let mut search = Search {
        pid,
        found: Vec::new(),
    };
    // SAFETY: the callback only touches `search`, which outlives the call.
    unsafe {
        let _ = EnumWindows(Some(each), LPARAM(&mut search as *mut Search as isize));
    }
    search.found
}

/// The window the agent that started this hook runs in. `project`, the
/// folder's name, picks among an editor's windows (one per folder).
pub fn agent_window(project: &str) -> Option<isize> {
    let list = processes();
    let chain = ancestors(&list);
    for p in &chain {
        if NOT_A_HOST.contains(&p.name.as_str()) {
            break;
        }
        if let Some(hwnd) = console_of(p.pid) {
            return Some(hwnd.0 as isize);
        }
    }
    let project = project.to_lowercase();
    for p in &chain {
        if NOT_A_HOST.contains(&p.name.as_str()) {
            break;
        }
        let found = windows_of(p.pid);
        let best = found
            .iter()
            .find(|&&h| !project.is_empty() && title(h).to_lowercase().contains(&project))
            .or(found.first());
        if let Some(hwnd) = best {
            return Some(hwnd.0 as isize);
        }
    }
    None
}

fn hwnd(value: isize) -> HWND {
    HWND(value as *mut c_void)
}

/// Brings the window to the front, restored if minimized. False when it is gone.
pub fn focus_window(window: isize) -> bool {
    let window = hwnd(window);
    // SAFETY: a stale handle is checked first; the calls only fail then.
    unsafe {
        if !IsWindow(Some(window)).as_bool() {
            return false;
        }
        if IsIconic(window).as_bool() {
            let _ = ShowWindow(window, SW_RESTORE);
        }
        SetForegroundWindow(window).as_bool()
    }
}

/// Whether the user is in this window now (it, or a window it owns, has the keyboard).
pub fn window_in_front(window: isize) -> bool {
    // SAFETY: read-only queries.
    unsafe {
        let front = GetForegroundWindow();
        if front.is_invalid() {
            return false;
        }
        let root = GetAncestor(front, GA_ROOTOWNER);
        front == hwnd(window) || (!root.is_invalid() && root == hwnd(window))
    }
}
