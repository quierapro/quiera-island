//! Detects WebView2 process failures so the island can recover instead of
//! sitting frozen or blank at the top of the screen.

use tauri::WebviewWindow;
use webview2_com::Microsoft::Web::WebView2::Win32::{
    COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
    COREWEBVIEW2_PROCESS_FAILED_KIND, COREWEBVIEW2_PROCESS_FAILED_KIND_BROWSER_PROCESS_EXITED,
    COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED,
    COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_UNRESPONSIVE, ICoreWebView2_19,
};
use webview2_com::ProcessFailedEventHandler;
use windows::core::Interface;

use crate::platform::WebviewFailure;

fn classify(kind: COREWEBVIEW2_PROCESS_FAILED_KIND) -> Option<WebviewFailure> {
    match kind {
        COREWEBVIEW2_PROCESS_FAILED_KIND_BROWSER_PROCESS_EXITED => {
            Some(WebviewFailure::BrowserGone)
        }
        COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED
        | COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_UNRESPONSIVE => {
            Some(WebviewFailure::RendererGone)
        }
        // Helper processes (GPU, utility…) restart on their own.
        _ => None,
    }
}

pub fn watch_webview(window: &WebviewWindow, handler: impl Fn(WebviewFailure) + Send + 'static) {
    let result = window.with_webview(move |webview| {
        // SAFETY: COM calls on the web view's own thread, inside with_webview.
        unsafe {
            let core = match webview.controller().CoreWebView2() {
                Ok(core) => core,
                Err(e) => {
                    log::warn!("cannot watch the web view: {e}");
                    return;
                }
            };
            let callback = ProcessFailedEventHandler::create(Box::new(move |_, args| {
                let Some(args) = args else { return Ok(()) };
                let mut kind = COREWEBVIEW2_PROCESS_FAILED_KIND::default();
                args.ProcessFailedKind(&mut kind)?;
                match classify(kind) {
                    Some(failure) => handler(failure),
                    None => log::info!(
                        "web view helper process failed ({kind:?}); it restarts by itself"
                    ),
                }
                Ok(())
            }));
            let mut token = 0i64;
            if let Err(e) = core.add_ProcessFailed(&callback, &mut token) {
                log::warn!("cannot watch the web view: {e}");
            }
        }
    });
    if let Err(e) = result {
        log::warn!("cannot reach the web view: {e}");
    }
}

/// Low memory while the island is closed: WebView2 trims what it can (its
/// caches, released graphics memory) and comes back on the next change.
pub fn set_webview_memory_low(window: &WebviewWindow, low: bool) {
    let level = if low {
        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW
    } else {
        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL
    };
    let _ = window.with_webview(move |webview| {
        // SAFETY: COM calls on the web view's own thread, inside with_webview.
        unsafe {
            if let Ok(core) = webview
                .controller()
                .CoreWebView2()
                .and_then(|c| c.cast::<ICoreWebView2_19>())
            {
                let _ = core.SetMemoryUsageTargetLevel(level);
            }
        }
    });
}
