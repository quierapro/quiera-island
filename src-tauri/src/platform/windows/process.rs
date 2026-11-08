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

/// The task, safe inside cmd's double quotes: no quote to close them, no
/// `%` to expand a variable, no line break to end the command.
pub fn cmd_quoted(task: &str) -> String {
    let safe = task
        .replace('"', "'")
        .replace('%', " pour cent ")
        .replace(['\r', '\n'], " ");
    format!("\"{safe}\"")
}

/// Starts `program` on `task` in a new console window (Windows Terminal,
/// where it is the default terminal), in `folder`. An npm launcher (`.cmd`)
/// goes through cmd, which keeps the window open after.
pub fn start_in_terminal(
    program: &std::path::Path,
    task: &str,
    folder: &std::path::Path,
) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;
    let script = program
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("cmd") || e.eq_ignore_ascii_case("bat"));
    let mut command = if script {
        let mut c = std::process::Command::new("cmd.exe");
        c.raw_arg(format!(
            "/k \"\"{}\" {}\"",
            program.display(),
            cmd_quoted(task)
        ));
        c
    } else {
        let mut c = std::process::Command::new(program);
        c.arg(task);
        c
    };
    command
        .current_dir(folder)
        .creation_flags(CREATE_NEW_CONSOLE)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_task_cannot_break_out_of_cmds_quotes() {
        assert_eq!(
            cmd_quoted("fix the \"login\" & tests 100%"),
            "\"fix the 'login' & tests 100 pour cent \""
        );
        assert_eq!(
            cmd_quoted(
                "a
b"
            ),
            "\"a b\""
        );
    }
}
