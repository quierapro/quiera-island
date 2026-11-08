//! The channel between AI agents and the island: a named pipe only the
//! current user can open, never reachable from another machine. Each
//! connection carries one message, a line of JSON; a reply, when one is
//! awaited (a permission asked), comes back on the same connection.

use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, Read, Write};
use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};

use windows::Win32::Foundation::{
    CloseHandle, ERROR_PIPE_BUSY, ERROR_PIPE_CONNECTED, HANDLE, HLOCAL, INVALID_HANDLE_VALUE,
    LocalFree,
};
use windows::Win32::Security::Authorization::{
    ConvertSidToStringSidW, ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1,
};
use windows::Win32::Security::{
    GetTokenInformation, PSECURITY_DESCRIPTOR, SECURITY_ATTRIBUTES, TOKEN_QUERY, TOKEN_USER,
    TokenUser,
};
use windows::Win32::Storage::FileSystem::{FILE_FLAG_FIRST_PIPE_INSTANCE, PIPE_ACCESS_DUPLEX};
use windows::Win32::System::Pipes::{
    ConnectNamedPipe, CreateNamedPipeW, PIPE_READMODE_BYTE, PIPE_REJECT_REMOTE_CLIENTS,
    PIPE_TYPE_BYTE, PIPE_UNLIMITED_INSTANCES, PIPE_WAIT, PeekNamedPipe, WaitNamedPipeW,
};
use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
use windows::core::{HSTRING, PCWSTR, PWSTR};

/// A message longer than this is not one of ours: it is dropped.
const MAX_MESSAGE: u64 = 64 * 1024;
/// How long the sender waits for a busy pipe before giving up.
const BUSY_WAIT_MS: u32 = 500;

/// The current user's SID, as text ("S-1-5-21-…").
fn user_sid() -> Option<String> {
    // SAFETY: the token is opened, queried into a buffer of the size it
    // asked for, and closed; the SID string is freed with LocalFree.
    unsafe {
        let mut token = HANDLE::default();
        OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).ok()?;
        let mut size = 0u32;
        let _ = GetTokenInformation(token, TokenUser, None, 0, &mut size);
        let mut buffer = vec![0u8; size as usize];
        let read = GetTokenInformation(
            token,
            TokenUser,
            Some(buffer.as_mut_ptr().cast()),
            size,
            &mut size,
        );
        let _ = CloseHandle(token);
        read.ok()?;
        let user = &*(buffer.as_ptr() as *const TOKEN_USER);
        let mut text = PWSTR::null();
        ConvertSidToStringSidW(user.User.Sid, &mut text).ok()?;
        let sid = text.to_string().ok();
        let _ = LocalFree(Some(HLOCAL(text.0.cast())));
        sid
    }
}

/// One pipe per user: two people signed in on the same PC each have theirs.
fn pipe_name(sid: &str) -> String {
    format!(r"\\.\pipe\quiera-agents-{sid}")
}

/// What handles a message: the message, and a check that its sender is
/// still connected (an agent interrupted while it waits hangs up).
type AgentHandler = dyn Fn(String, &dyn Fn() -> bool) -> Option<String> + Send + Sync;

/// Calls `handler` with each message an agent sends, on a thread of its own
/// per connection; what it returns, if anything, is sent back as the reply.
pub fn serve_agent_pipe(
    handler: impl Fn(String, &dyn Fn() -> bool) -> Option<String> + Send + Sync + 'static,
) {
    let Some(sid) = user_sid() else {
        log::warn!("agents: could not read the user's identity; the agents' pipe is off");
        return;
    };
    let handler = std::sync::Arc::new(handler);
    std::thread::spawn(move || {
        let name = HSTRING::from(pipe_name(&sid));
        // Only this user may connect: not other accounts, not the network.
        let sddl = HSTRING::from(format!("D:P(A;;GA;;;{sid})"));
        let mut descriptor = PSECURITY_DESCRIPTOR::default();
        // SAFETY: the descriptor is built from a constant-shaped string and
        // lives as long as the thread that creates pipes with it.
        if unsafe {
            ConvertStringSecurityDescriptorToSecurityDescriptorW(
                PCWSTR(sddl.as_ptr()),
                SDDL_REVISION_1,
                &mut descriptor,
                None,
            )
        }
        .is_err()
        {
            log::warn!("agents: could not secure the pipe; it stays off");
            return;
        }
        let attributes = SECURITY_ATTRIBUTES {
            nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: descriptor.0,
            bInheritHandle: false.into(),
        };
        let mut first = true;
        loop {
            // The first instance must be new: no other program may have
            // created the pipe before Quiera to listen in its place.
            let open_mode = if first {
                PIPE_ACCESS_DUPLEX | FILE_FLAG_FIRST_PIPE_INSTANCE
            } else {
                PIPE_ACCESS_DUPLEX
            };
            // SAFETY: plain call; the handle is checked, then owned by a File.
            let pipe = unsafe {
                CreateNamedPipeW(
                    PCWSTR(name.as_ptr()),
                    open_mode,
                    PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
                    PIPE_UNLIMITED_INSTANCES,
                    4096,
                    4096,
                    0,
                    Some(&attributes),
                )
            };
            if pipe == INVALID_HANDLE_VALUE {
                log::warn!(
                    "agents: could not open the pipe ({}); it stays off",
                    windows::core::Error::from_thread()
                );
                return;
            }
            first = false;
            // SAFETY: waits for a client on the handle just created.
            let connected = match unsafe { ConnectNamedPipe(pipe, None) } {
                Ok(()) => true,
                Err(e) => e.code() == ERROR_PIPE_CONNECTED.to_hresult(),
            };
            // SAFETY: the handle is valid and owned by nothing else.
            let file = File::from(unsafe { OwnedHandle::from_raw_handle(pipe.0) });
            if !connected {
                continue;
            }
            let handler = handler.clone();
            std::thread::spawn(move || answer(file, handler.as_ref()));
        }
    });
}

/// Reads one message from a connection, and writes back the reply, if any.
fn answer(file: File, handler: &AgentHandler) {
    let mut line = String::new();
    let mut reader = BufReader::new((&file).take(MAX_MESSAGE));
    if reader.read_line(&mut line).is_err() || line.trim().is_empty() {
        return;
    }
    let pipe = HANDLE(file.as_raw_handle());
    // SAFETY: peeks at the pipe without reading: fails once the client is gone.
    let alive = || unsafe { PeekNamedPipe(pipe, None, 0, None, None, None) }.is_ok();
    if let Some(reply) = handler(line.trim_end().to_owned(), &alive) {
        let mut writer = &file;
        let _ = writer.write_all(format!("{reply}\n").as_bytes());
        let _ = writer.flush();
    }
}

/// Sends one message to the island, and with `reply`, waits for its answer
/// (none when Quiera is not running, or has nothing to say: the agent then
/// goes on as if nothing had been sent).
pub fn send_agent_message(message: &str, reply: bool) -> Option<String> {
    let sid = user_sid()?;
    let name = pipe_name(&sid);
    let mut pipe = match OpenOptions::new().read(true).write(true).open(&name) {
        Ok(pipe) => pipe,
        Err(e) if e.raw_os_error() == Some(ERROR_PIPE_BUSY.0 as i32) => {
            // Every instance is taken for a moment: wait for one, once.
            let wide = HSTRING::from(name.as_str());
            // SAFETY: plain call with a valid string.
            if !unsafe { WaitNamedPipeW(PCWSTR(wide.as_ptr()), BUSY_WAIT_MS) }.as_bool() {
                return None;
            }
            OpenOptions::new().read(true).write(true).open(&name).ok()?
        }
        Err(_) => return None,
    };
    pipe.write_all(format!("{message}\n").as_bytes()).ok()?;
    if !reply {
        return None;
    }
    let mut answer = String::new();
    BufReader::new(pipe.take(MAX_MESSAGE))
        .read_line(&mut answer)
        .ok()?;
    let answer = answer.trim();
    (!answer.is_empty()).then(|| answer.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, mpsc};
    use std::time::Duration;

    /// The real pipe: a message sent arrives, and a hook run as the agent
    /// would run it (`QUIERA_EXE`: the built app) gets through too.
    #[test]
    #[ignore = "opens the user's agents pipe: run by hand, with Quiera closed"]
    fn messages_go_through_the_pipe() {
        let (sent, received) = mpsc::channel();
        let sent = Mutex::new(sent);
        serve_agent_pipe(move |line, alive| {
            assert!(alive());
            let reply = line.contains("ask").then(|| "yes".to_owned());
            let _ = sent.lock().unwrap().send(line);
            reply
        });
        std::thread::sleep(Duration::from_millis(200));
        assert_eq!(send_agent_message(r#"{"hello":1}"#, false), None);
        let got = received.recv_timeout(Duration::from_secs(2)).unwrap();
        assert_eq!(got, r#"{"hello":1}"#);
        assert_eq!(
            send_agent_message(r#"{"ask":1}"#, true).as_deref(),
            Some("yes")
        );
        received.recv_timeout(Duration::from_secs(2)).unwrap();

        if let Some(exe) = std::env::var_os("QUIERA_EXE") {
            let mut hook = std::process::Command::new(exe)
                .args(["--agent-event", "claude"])
                .stdin(std::process::Stdio::piped())
                .spawn()
                .unwrap();
            let event = r#"{"hook_event_name":"PreToolUse","session_id":"t1","cwd":"D:/code/demo","tool_name":"Edit","tool_input":{"file_path":"D:/code/demo/auth.ts","old_string":"SECRET"}}"#;
            hook.stdin
                .take()
                .unwrap()
                .write_all(event.as_bytes())
                .unwrap();
            assert!(hook.wait().unwrap().success());
            let got = received.recv_timeout(Duration::from_secs(3)).unwrap();
            assert!(got.contains(r#""target":"auth.ts""#), "{got}");
            assert!(!got.contains("SECRET"), "{got}");
        }
    }
}
