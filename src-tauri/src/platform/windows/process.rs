use std::time::Duration;

use windows::Win32::Foundation::{CloseHandle, WAIT_TIMEOUT};
use windows::Win32::System::Threading::{OpenProcess, PROCESS_SYNCHRONIZE, WaitForSingleObject};

/// Blocks until process `pid` has exited, or `timeout` has passed. Returns
/// at once when the process is already gone.
pub fn wait_for_process_exit(pid: u32, timeout: Duration) {
    // SAFETY: the handle is opened, waited on and closed here.
    unsafe {
        let Ok(process) = OpenProcess(PROCESS_SYNCHRONIZE, false, pid) else {
            return;
        };
        let millis = u32::try_from(timeout.as_millis()).unwrap_or(u32::MAX);
        if WaitForSingleObject(process, millis) == WAIT_TIMEOUT {
            eprintln!("process {pid} still running after {timeout:?}; starting anyway");
        }
        let _ = CloseHandle(process);
    }
}

/// Background priority for the calling thread (CPU and disk), for work
/// nobody waits on, like walking the drives.
pub fn lower_thread_priority() {
    // SAFETY: changes the calling thread's own priority.
    unsafe {
        let _ = windows::Win32::System::Threading::SetThreadPriority(
            windows::Win32::System::Threading::GetCurrentThread(),
            windows::Win32::System::Threading::THREAD_MODE_BACKGROUND_BEGIN,
        );
    }
}
