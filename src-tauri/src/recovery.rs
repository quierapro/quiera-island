//! Recovery after the web view fails: reload the page when only its renderer
//! died; relaunch Quiera when the whole web view is gone (WebView2 cannot
//! build a new one in the same process). Gives up and quits cleanly when
//! failures keep coming, instead of looping.

use std::collections::VecDeque;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager};

use crate::island;
use crate::platform::{self, WebviewFailure};

/// Passed to a relaunched Quiera with the PID it must wait for, so the
/// single-instance guard of the old process is gone before it starts.
const RELAUNCH_ARG: &str = "--relaunch-after";

/// A relaunched Quiera that fails again this soon gives up.
const RELAUNCH_GRACE: Duration = Duration::from_secs(30);

/// Allows at most `limit` recoveries within `window`.
#[derive(Debug)]
pub struct CrashBudget {
    limit: usize,
    window: Duration,
    recent: VecDeque<Instant>,
}

impl CrashBudget {
    pub fn new(limit: usize, window: Duration) -> Self {
        Self {
            limit,
            window,
            recent: VecDeque::new(),
        }
    }

    /// Records a failure at `now`; false when the budget is spent.
    pub fn allow(&mut self, now: Instant) -> bool {
        while self
            .recent
            .front()
            .is_some_and(|&t| now.duration_since(t) > self.window)
        {
            self.recent.pop_front();
        }
        self.recent.push_back(now);
        self.recent.len() <= self.limit
    }
}

/// The PID given after `--relaunch-after`, if any.
pub fn relaunched_after(args: &[String]) -> Option<u32> {
    let i = args.iter().position(|a| a == RELAUNCH_ARG)?;
    args.get(i + 1)?.parse().ok()
}

static STARTED: OnceLock<(Instant, bool)> = OnceLock::new();

/// Call first thing at startup: waits for the process that relaunched us.
pub fn on_startup() {
    let args: Vec<String> = std::env::args().collect();
    let parent = relaunched_after(&args);
    STARTED.get_or_init(|| (Instant::now(), parent.is_some()));
    if let Some(pid) = parent {
        platform::wait_for_process_exit(pid, Duration::from_secs(10));
    }
}

static BUDGET: std::sync::Mutex<Option<CrashBudget>> = std::sync::Mutex::new(None);

fn allow_recovery() -> bool {
    let mut guard = BUDGET.lock().unwrap_or_else(|e| e.into_inner());
    guard
        .get_or_insert_with(|| CrashBudget::new(3, Duration::from_secs(60)))
        .allow(Instant::now())
}

/// Watches the island's web view and recovers from its failures.
pub fn watch(handle: &AppHandle) {
    let Some(window) = handle.get_webview_window(island::LABEL) else {
        return;
    };
    let handle = handle.clone();
    platform::watch_webview(&window, move |failure| {
        log::error!("web view failure: {failure:?}");
        let handle = handle.clone();
        // Leave the WebView2 callback before touching windows.
        tauri::async_runtime::spawn(async move { recover(handle, failure) });
    });
}

fn recover(handle: AppHandle, failure: WebviewFailure) {
    if !allow_recovery() {
        log::error!("too many web view failures in a minute; quitting");
        handle.exit(1);
        return;
    }
    match failure {
        WebviewFailure::RendererGone => {
            log::warn!("reloading the island");
            if let Some(window) = handle.get_webview_window(island::LABEL)
                && let Err(e) = window.reload()
            {
                log::error!("reload failed: {e}");
            }
        }
        WebviewFailure::BrowserGone => relaunch(&handle),
    }
}

fn relaunch(handle: &AppHandle) {
    if let Some((started, true)) = STARTED.get()
        && started.elapsed() < RELAUNCH_GRACE
    {
        log::error!("the web view failed again right after a relaunch; quitting");
        handle.exit(1);
        return;
    }
    let spawned = std::env::current_exe().and_then(|exe| {
        std::process::Command::new(exe)
            .arg(RELAUNCH_ARG)
            .arg(std::process::id().to_string())
            .spawn()
    });
    match spawned {
        Ok(child) => {
            log::warn!("relaunching Quiera (new PID {})", child.id());
            handle.exit(0);
        }
        Err(e) => {
            log::error!("could not relaunch Quiera: {e}; quitting");
            handle.exit(1);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_up_to_the_limit_then_refuses() {
        let mut budget = CrashBudget::new(3, Duration::from_secs(60));
        let t = Instant::now();
        assert!(budget.allow(t));
        assert!(budget.allow(t + Duration::from_secs(1)));
        assert!(budget.allow(t + Duration::from_secs(2)));
        assert!(!budget.allow(t + Duration::from_secs(3)));
    }

    #[test]
    fn forgets_failures_older_than_the_window() {
        let mut budget = CrashBudget::new(1, Duration::from_secs(60));
        let t = Instant::now();
        assert!(budget.allow(t));
        assert!(!budget.allow(t + Duration::from_secs(30)));
        assert!(budget.allow(t + Duration::from_secs(120)));
    }

    #[test]
    fn reads_the_pid_to_wait_for() {
        let args = |v: &[&str]| v.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        assert_eq!(
            relaunched_after(&args(&["quiera.exe", RELAUNCH_ARG, "4242"])),
            Some(4242)
        );
        assert_eq!(relaunched_after(&args(&["quiera.exe"])), None);
        assert_eq!(relaunched_after(&args(&["quiera.exe", RELAUNCH_ARG])), None);
        assert_eq!(
            relaunched_after(&args(&["quiera.exe", RELAUNCH_ARG, "x"])),
            None
        );
    }
}
