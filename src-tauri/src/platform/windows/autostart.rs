//! Starting with Windows: the per-user `Run` key, which Windows reads at
//! sign-in (and lists in Task Manager's Startup apps, where people can turn
//! it off too).

use std::ffi::c_void;

use windows::Win32::Foundation::ERROR_FILE_NOT_FOUND;
use windows::Win32::System::Registry::{
    HKEY_CURRENT_USER, REG_SZ, RegDeleteKeyValueW, RegSetKeyValueW,
};
use windows::core::{HSTRING, PCWSTR, w};

const RUN: PCWSTR = w!("Software\\Microsoft\\Windows\\CurrentVersion\\Run");
/// Its own name, not "Quiera": another program may use that one, and
/// turning this off must only ever remove ours.
const NAME: PCWSTR = w!("QuieraIsland");

pub fn set_autostart(enabled: bool) -> Result<(), String> {
    if !enabled {
        // SAFETY: removes our own value from the current user's Run key.
        let result = unsafe { RegDeleteKeyValueW(HKEY_CURRENT_USER, RUN, NAME) };
        return if result.is_ok() || result == ERROR_FILE_NOT_FOUND {
            Ok(())
        } else {
            Err(format!("could not remove the startup entry: {result:?}"))
        };
    }
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    // Quoted: the path may hold spaces.
    let command = HSTRING::from(format!("\"{}\"", exe.display()));
    let bytes = (command.len() + 1) * 2;
    // SAFETY: the value is a nul-terminated wide string of \`bytes\` bytes.
    let result = unsafe {
        RegSetKeyValueW(
            HKEY_CURRENT_USER,
            RUN,
            NAME,
            REG_SZ.0,
            Some(command.as_ptr() as *const c_void),
            bytes as u32,
        )
    };
    result
        .ok()
        .map_err(|e| format!("could not add the startup entry: {e}"))
}
