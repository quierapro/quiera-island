//! A native crash (an access violation in a system call, say) ends the
//! process without a word in the log. This handler writes what crashed and
//! where (the stack of the faulting thread) first, so the next crash can be
//! fixed rather than guessed at.

use windows::Win32::System::Diagnostics::Debug::{EXCEPTION_POINTERS, SetUnhandledExceptionFilter};

/// Lets the crash go on to Windows once logged.
const EXCEPTION_CONTINUE_SEARCH: i32 = 0;

unsafe extern "system" fn on_crash(info: *const EXCEPTION_POINTERS) -> i32 {
    // SAFETY: Windows passes the record of the exception being handled.
    let (code, address) = unsafe {
        info.as_ref()
            .and_then(|i| i.ExceptionRecord.as_ref())
            .map_or((0, std::ptr::null_mut()), |r| {
                (r.ExceptionCode.0 as u32, r.ExceptionAddress)
            })
    };
    let thread = std::thread::current();
    log::error!(
        "crash: exception 0x{code:08x} at {address:?} on thread {:?}\n{}",
        thread.name().unwrap_or("?"),
        std::backtrace::Backtrace::force_capture()
    );
    log::logger().flush();
    EXCEPTION_CONTINUE_SEARCH
}

pub fn install_crash_logger() {
    // SAFETY: installs a process-wide filter that only logs.
    unsafe {
        SetUnhandledExceptionFilter(Some(on_crash));
    }
}
