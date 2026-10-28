//! Files dropped on the island, received through WebView2 itself.
//!
//! Recent WebView2 runtimes register their own drop target on the browser
//! process's window, in front of the one Tauri (wry) places on the host
//! window: with Tauri's handling on, WebView2 refuses every drop. So the page
//! takes the drop, and hands the files back with
//! `chrome.webview.postMessageWithAdditionalObjects`, the WebView2 way to
//! learn their paths.

use std::path::PathBuf;

use tauri::WebviewWindow;
use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2Controller4, ICoreWebView2File, ICoreWebView2WebMessageReceivedEventArgs2,
};
use webview2_com::{WebMessageReceivedEventHandler, take_pwstr};
use windows::core::{BOOL, Interface, PWSTR};

/// The message the page posts along with the dropped files.
const DROP_MESSAGE: &str = "quiera://drop";

pub fn watch_file_drops(window: &WebviewWindow, handler: impl Fn(Vec<PathBuf>) + Send + 'static) {
    let result = window.with_webview(move |webview| {
        // SAFETY: COM calls on the web view's own thread, inside with_webview
        // and its event callbacks.
        unsafe {
            // The page needs WebView2 to accept drops (Tauri's own handling,
            // off in tauri.conf.json, would forbid them).
            if let Ok(controller) = webview.controller().cast::<ICoreWebView2Controller4>() {
                let mut allowed = BOOL::default();
                let _ = controller.AllowExternalDrop(&mut allowed);
                if !allowed.as_bool() {
                    let _ = controller.SetAllowExternalDrop(true);
                }
            }
            let core = match webview.controller().CoreWebView2() {
                Ok(core) => core,
                Err(e) => {
                    log::warn!("cannot receive dropped files: {e}");
                    return;
                }
            };
            let callback = WebMessageReceivedEventHandler::create(Box::new(move |_, args| {
                let Some(args) = args else { return Ok(()) };
                let mut message = PWSTR::null();
                // Tauri's IPC shares this channel: only the drop message is ours.
                if args.TryGetWebMessageAsString(&mut message).is_err()
                    || take_pwstr(message) != DROP_MESSAGE
                {
                    return Ok(());
                }
                let objects = args
                    .cast::<ICoreWebView2WebMessageReceivedEventArgs2>()?
                    .AdditionalObjects()?;
                let mut count = 0;
                objects.Count(&mut count)?;
                let mut paths = Vec::new();
                for i in 0..count {
                    let Ok(file) = objects.GetValueAtIndex(i)?.cast::<ICoreWebView2File>() else {
                        continue;
                    };
                    let mut path = PWSTR::null();
                    if file.Path(&mut path).is_ok() {
                        let path = take_pwstr(path);
                        if !path.is_empty() {
                            paths.push(PathBuf::from(path));
                        }
                    }
                }
                // The count only: file names stay out of the log.
                log::info!("files dropped: {}", paths.len());
                if !paths.is_empty() {
                    handler(paths);
                }
                Ok(())
            }));
            let mut token = 0i64;
            if let Err(e) = core.add_WebMessageReceived(&callback, &mut token) {
                log::warn!("cannot receive dropped files: {e}");
            }
        }
    });
    if let Err(e) = result {
        log::warn!("cannot reach the web view: {e}");
    }
}
