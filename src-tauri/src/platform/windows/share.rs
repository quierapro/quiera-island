//! Windows' Share panel, for Shelf files: it offers what the PC can send to
//! (Phone Link, Quick Share for Android when installed, Nearby sharing, mail…).

use std::cell::RefCell;
use std::path::PathBuf;

use tauri::WebviewWindow;
use windows::ApplicationModel::DataTransfer::{DataRequestedEventArgs, DataTransferManager};
use windows::Foundation::TypedEventHandler;
use windows::Storage::{IStorageItem, StorageFile};
use windows::Win32::UI::Shell::IDataTransferManagerInterop;
use windows::core::{HSTRING, Interface};
use windows_collections::IIterable;

/// What the panel gets when it asks: a title and the files, opened beforehand.
struct Shared {
    title: HSTRING,
    // Collections of interfaces hold options (a slot may be null).
    items: Vec<Option<IStorageItem>>,
}

thread_local! {
    // All on the island window's thread: the command runs there, and the
    // panel asks for the data there. Storage files do not move between
    // threads, so the handler reads them from here instead of capturing them.
    static SHARED: RefCell<Option<Shared>> = const { RefCell::new(None) };
    /// The manager whose `DataRequested` is handled: registered once.
    static MANAGER: RefCell<Option<DataTransferManager>> = const { RefCell::new(None) };
}

/// Opens the panel for `paths`. Runs on the island window's thread (a
/// synchronous command), as the panel requires.
pub fn share_files(window: &WebviewWindow, paths: &[PathBuf]) -> Result<(), String> {
    let hwnd = window.hwnd().map_err(|e| e.to_string())?;
    // Opened now, not when the panel asks: it gives its handler little time.
    let mut items = Vec::with_capacity(paths.len());
    for path in paths {
        let file = StorageFile::GetFileFromPathAsync(&HSTRING::from(path.as_os_str()))
            .and_then(|op| op.join())
            .and_then(|f| f.cast::<IStorageItem>())
            .map_err(|_| "Un fichier a été déplacé ou ne peut pas être lu.".to_owned())?;
        items.push(Some(file));
    }
    let title = match paths {
        [one] => one
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default(),
        _ => format!("{} fichiers", paths.len()),
    };
    SHARED.with_borrow_mut(|s| {
        *s = Some(Shared {
            title: HSTRING::from(title),
            items,
        })
    });

    let interop = windows::core::factory::<DataTransferManager, IDataTransferManagerInterop>()
        .map_err(|e| e.to_string())?;
    if MANAGER.with_borrow(Option::is_none) {
        // SAFETY: `hwnd` is the island's live window, on this thread.
        let manager: DataTransferManager =
            unsafe { interop.GetForWindow(hwnd) }.map_err(|e| e.to_string())?;
        let handler =
            TypedEventHandler::<DataTransferManager, DataRequestedEventArgs>::new(|_, args| {
                let data = args.ok()?.Request()?.Data()?;
                SHARED.with_borrow(|shared| {
                    let Some(shared) = shared else {
                        return Ok(());
                    };
                    data.Properties()?.SetTitle(&shared.title)?;
                    data.SetStorageItemsReadOnly(&IIterable::<IStorageItem>::from(
                        shared.items.clone(),
                    ))
                })
            });
        manager.DataRequested(&handler).map_err(|e| e.to_string())?;
        MANAGER.with_borrow_mut(|m| *m = Some(manager));
    }
    // SAFETY: as above.
    unsafe { interop.ShowShareUIForWindow(hwnd) }.map_err(|e| e.to_string())
}
