//! The launcher: a shortcut opens a search bar in the island to find and
//! open apps (the page also computes and searches the web). The island takes
//! the keyboard while it is open and gives it back after.

use std::collections::HashMap;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::http::{Response, StatusCode, header};
use tauri::{AppHandle, Emitter, Manager};

use tauri_plugin_opener::OpenerExt;

use crate::icon_cache::IconCache;
use crate::settings::{self, Shortcut};
use crate::{files, island, platform, protocol};

pub const OPEN_EVENT: &str = "launcher://open";
pub const CLOSE_EVENT: &str = "launcher://close";
pub const ICON_SCHEME: &str = "quiera-launch";
const ICON_SIZE: u32 = 32;
/// How long Windows gets to hand the island the keyboard.
const FOCUS_CHECK: Duration = Duration::from_millis(400);
/// Apps are listed again after this long, to catch new installs.
const APPS_FRESH_FOR: Duration = Duration::from_secs(60);

/// An app as the platform lists it.
pub struct LaunchApp {
    pub name: String,
    /// What opens it (an app user model id, or a path).
    pub id: String,
}

/// Mirrors `LauncherApp` in `src/ipc/launcher.ts`.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct LauncherApp {
    pub key: String,
    pub name: String,
    pub icon: String,
}

static OPEN: AtomicBool = AtomicBool::new(false);
static SHORTCUT: Mutex<Option<Shortcut>> = Mutex::new(None);

struct Apps {
    listed: Option<Instant>,
    /// Ids by key, so the page never sends an id of its own.
    ids: HashMap<String, String>,
    items: Vec<LauncherApp>,
}

static APPS: LazyLock<Mutex<Apps>> = LazyLock::new(|| {
    Mutex::new(Apps {
        listed: None,
        ids: HashMap::new(),
        items: Vec::new(),
    })
});
static ICONS: LazyLock<IconCache> = LazyLock::new(IconCache::default);

fn key_of(id: &str) -> String {
    let mut hasher = DefaultHasher::new();
    id.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// Uninstallers and the like sit in the Applications folder too: not apps
/// anyone means to open from a launcher.
pub fn is_launchable(name: &str) -> bool {
    let lower = name.to_lowercase();
    ![
        "uninstall",
        "désinstaller",
        "desinstaller",
        "désinstallation",
    ]
    .iter()
    .any(|word| lower.starts_with(word))
}

fn open(app: &AppHandle) {
    if !settings::get().launcher.enabled || OPEN.swap(true, Ordering::Relaxed) {
        return;
    }
    if let Some(window) = app.get_webview_window(island::LABEL) {
        platform::focus_island(&window);
    }
    let _ = app.emit(OPEN_EVENT, ());
    files::refresh_if_stale();
    // Windows may refuse the keyboard (another app holds the foreground):
    // a search bar nobody can type in would only sit there, so it closes.
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(FOCUS_CHECK);
        if OPEN.load(Ordering::Relaxed) && !platform::island_has_focus() {
            log::warn!("launcher: Windows did not give it the keyboard");
            close(&app, false);
        }
    });
}

fn close(app: &AppHandle, restore: bool) {
    if !OPEN.swap(false, Ordering::Relaxed) {
        return;
    }
    if restore {
        platform::restore_focus();
    }
    let _ = app.emit(CLOSE_EVENT, ());
}

pub fn start(app: &AppHandle) {
    let handle = app.clone();
    platform::start_launcher_hotkey(move || {
        if OPEN.load(Ordering::Relaxed) {
            close(&handle, true);
        } else {
            open(&handle);
        }
    });
    apply_shortcut();
}

/// Holds the shortcut the settings ask for, or the first free one when
/// another app holds it; none when the launcher is off.
pub fn apply_shortcut() {
    let wanted = settings::get().launcher;
    let held = if wanted.enabled {
        std::iter::once(wanted.shortcut)
            .chain(Shortcut::ALL.into_iter().filter(|s| *s != wanted.shortcut))
            .find(|s| platform::set_launcher_hotkey(Some(*s)))
    } else {
        platform::set_launcher_hotkey(None);
        None
    };
    match held {
        Some(s) => log::info!("launcher shortcut: {s:?}"),
        None if wanted.enabled => log::warn!("launcher: every shortcut is taken by another app"),
        None => log::info!("launcher off"),
    }
    *SHORTCUT.lock().unwrap_or_else(|e| e.into_inner()) = held;
}

/// The shortcut held now (it may differ from the one chosen, when taken).
#[tauri::command]
pub fn launcher_shortcut() -> Option<Shortcut> {
    *SHORTCUT.lock().unwrap_or_else(|e| e.into_inner())
}

/// The apps to search, listed again when the list is old.
#[tauri::command]
pub async fn launcher_apps() -> Vec<LauncherApp> {
    let fresh = APPS
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .listed
        .is_some_and(|at| at.elapsed() < APPS_FRESH_FOR);
    if !fresh {
        let listed = platform::list_apps();
        let mut ids = HashMap::new();
        let mut items: Vec<LauncherApp> = listed
            .into_iter()
            .filter(|a| is_launchable(&a.name))
            .map(|a| {
                let key = key_of(&a.id);
                ids.insert(key.clone(), a.id);
                LauncherApp {
                    icon: protocol::url(ICON_SCHEME, &key),
                    key,
                    name: a.name,
                }
            })
            .collect();
        items.sort_by_key(|a| a.name.to_lowercase());
        items.dedup_by(|a, b| a.key == b.key);
        let mut apps = APPS.lock().unwrap_or_else(|e| e.into_inner());
        *apps = Apps {
            listed: Some(Instant::now()),
            ids,
            items,
        };
    }
    APPS.lock().unwrap_or_else(|e| e.into_inner()).items.clone()
}

/// Opens an app; the launcher closes and the app takes the keyboard.
#[tauri::command]
pub fn launcher_launch(app: AppHandle, key: String) -> Result<(), String> {
    let id = APPS
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .ids
        .get(&key)
        .cloned()
        .ok_or("unknown app")?;
    platform::launch_app(&id)?;
    close(&app, false);
    Ok(())
}

/// Mirrors `FileResults` in `src/ipc/launcher.ts`.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct FileResults {
    /// False while the first walk of the drives runs.
    pub ready: bool,
    pub hits: Vec<files::FileHit>,
}

#[tauri::command]
pub async fn launcher_files(query: String, limit: usize) -> FileResults {
    FileResults {
        ready: files::ready(),
        hits: files::search(&query, limit.min(20)),
    }
}

/// Opens a file or folder, or shows it in Explorer with `reveal`.
#[tauri::command]
pub fn launcher_open_file(
    app: AppHandle,
    id: u32,
    generation: u32,
    reveal: bool,
) -> Result<(), String> {
    let path = files::path_of(id, generation).ok_or("the index changed: search again")?;
    let opener = app.opener();
    if reveal {
        opener
            .reveal_item_in_dir(&path)
            .map_err(|e| e.to_string())?;
    } else {
        opener
            .open_path(path.to_string_lossy(), None::<&str>)
            .map_err(|e| e.to_string())?;
    }
    close(&app, false);
    Ok(())
}

/// Opens the launcher from the island (the welcome's "Essayer").
#[tauri::command]
pub fn launcher_open(app: AppHandle) {
    open(&app);
}

/// Closes the launcher; `restore` gives the keyboard back to the window
/// that had it (not when something else was just opened).
#[tauri::command]
pub fn launcher_close(app: AppHandle, restore: bool) {
    close(&app, restore);
}

/// Serves an app's icon (`/<key>`), read from the shell once per app.
pub fn serve_icon(path: &str, responder: tauri::UriSchemeResponder) {
    let key = path.trim_start_matches('/').to_owned();
    std::thread::spawn(move || {
        // A file: its icon or preview, from the shell (not kept here: the
        // web view caches it).
        let file = key.strip_prefix('f').and_then(|rest| {
            let (generation, id) = rest.split_once('-')?;
            Some((id.parse().ok()?, generation.parse().ok()?))
        });
        if let Some((id, generation)) = file {
            let png = files::path_of(id, generation)
                .and_then(|path| platform::file_thumbnail(&path, ICON_SIZE));
            responder.respond(png_response(png));
            return;
        }
        let png = ICONS.get_or_load(&key, || {
            let id = APPS
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .ids
                .get(&key)
                .cloned()?;
            platform::file_thumbnail(
                std::path::Path::new(&format!("shell:AppsFolder\\{id}")),
                ICON_SIZE,
            )
        });
        responder.respond(png_response(png));
    });
}

fn png_response(png: Option<Vec<u8>>) -> Response<Vec<u8>> {
    let response = match png {
        Some(png) => Response::builder()
            .header(header::CONTENT_TYPE, "image/png")
            .header(header::CACHE_CONTROL, "max-age=3600")
            .body(png),
        None => Response::builder()
            .status(StatusCode::NOT_FOUND)
            // Not cached by the web view: it may come later.
            .header(header::CACHE_CONTROL, "no-store")
            .body(Vec::new()),
    };
    response.unwrap_or_else(|_| Response::new(Vec::new()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uninstallers_are_left_out() {
        assert!(is_launchable("Spotify"));
        assert!(is_launchable("Discord"));
        assert!(!is_launchable("Uninstall Steam"));
        assert!(!is_launchable("Désinstaller Medal"));
        assert!(
            is_launchable("Steam Uninstaller Helper Docs"),
            "only a leading word counts"
        );
    }
}
