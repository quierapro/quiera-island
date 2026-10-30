//! Updates: Quiera looks for a new release on GitHub a minute after it
//! starts, then every six hours (when the settings allow), and says so on the
//! island and in the tray menu. Installing downloads the new installer,
//! checks its signature against the key built into the app, and runs it;
//! Quiera closes and comes back updated.

use std::sync::{LazyLock, Mutex};
use std::time::Duration;

use serde::Serialize;
use tauri::menu::MenuItem;
use tauri::{AppHandle, Emitter, Manager, Wry};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::peeks::{self, SystemPeek};

pub const STATUS_EVENT: &str = "updates://status";
const FIRST_CHECK: Duration = Duration::from_secs(60);
const EVERY: Duration = Duration::from_secs(6 * 60 * 60);

/// Mirrors `UpdateStatus` in `src/ipc/updates.ts`.
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub current: String,
    /// The newer version found, if any.
    pub available: Option<String>,
    pub checking: bool,
    pub installing: bool,
    /// Why the last check or install failed.
    pub error: Option<String>,
}

struct State {
    status: Status,
    update: Option<Update>,
    /// The version already announced on the island, so it is said once.
    announced: Option<String>,
}

static STATE: LazyLock<Mutex<State>> = LazyLock::new(|| {
    Mutex::new(State {
        status: Status::default(),
        update: None,
        announced: None,
    })
});

fn state() -> std::sync::MutexGuard<'static, State> {
    STATE.lock().unwrap_or_else(|e| e.into_inner())
}

/// The tray's update item, renamed when a version is found.
pub struct TrayItem(pub MenuItem<Wry>);

fn changed(app: &AppHandle) {
    let status = state().status.clone();
    if let Some(item) = app.try_state::<TrayItem>() {
        let text = match &status.available {
            Some(version) => format!("Installer la mise à jour {version}"),
            None => "Rechercher des mises à jour".to_owned(),
        };
        let _ = item.0.set_text(text);
    }
    if let Err(e) = app.emit(STATUS_EVENT, status) {
        log::warn!("could not send the update status: {e}");
    }
}

/// Starts the periodic check, on its own thread: it sleeps most of the time.
pub fn start(app: &AppHandle) {
    state().status.current = app.package_info().version.to_string();
    let app = app.clone();
    let spawned = std::thread::Builder::new()
        .name("quiera-updates".into())
        .spawn(move || {
            std::thread::sleep(FIRST_CHECK);
            loop {
                if crate::settings::get().general.check_updates {
                    tauri::async_runtime::block_on(check(&app, false));
                }
                std::thread::sleep(EVERY);
            }
        });
    if let Err(e) = spawned {
        log::error!("could not start the update check: {e}");
    }
}

/// Looks for a new version. `manual`: asked by the user, who sees errors.
async fn check(app: &AppHandle, manual: bool) {
    {
        let mut state = state();
        if state.status.checking || state.status.installing {
            return;
        }
        state.status.checking = true;
        state.status.error = None;
    }
    changed(app);
    let result = match app.updater() {
        Ok(updater) => updater.check().await.map_err(|e| e.to_string()),
        Err(e) => Err(e.to_string()),
    };
    let announce = {
        let mut state = state();
        state.status.checking = false;
        match result {
            Ok(found) => {
                state.status.available = found.as_ref().map(|u| u.version.clone());
                state.update = found;
            }
            Err(e) => {
                log::warn!("update check failed: {e}");
                if manual {
                    state.status.error = Some("Impossible de vérifier (pas de connexion ?)".into());
                }
            }
        }
        let version = state.status.available.clone();
        let new = version.is_some() && version != state.announced;
        if new {
            state.announced.clone_from(&version);
        }
        new.then_some(version).flatten()
    };
    changed(app);
    if let Some(version) = announce {
        log::info!("update available: {version}");
        peeks::announce(app, SystemPeek::Update { version });
    }
}

/// Downloads, verifies and runs the new version's installer. On Windows the
/// installer closes Quiera, updates it and starts it again.
async fn install(app: &AppHandle) -> Result<(), String> {
    let update = {
        let mut state = state();
        let Some(update) = state.update.clone() else {
            return Err("Aucune mise à jour à installer.".into());
        };
        if state.status.installing {
            return Ok(());
        }
        state.status.installing = true;
        state.status.error = None;
        update
    };
    changed(app);
    log::info!("installing update {}", update.version);
    let result = update.download_and_install(|_, _| {}, || {}).await;
    if let Err(e) = result {
        log::warn!("update failed: {e}");
        {
            let mut state = state();
            state.status.installing = false;
            state.status.error = Some("La mise à jour n'a pas pu être installée.".into());
        }
        changed(app);
        return Err(e.to_string());
    }
    // Where the installer does not close the app itself.
    app.restart();
}

#[tauri::command]
pub fn updates_status() -> Status {
    state().status.clone()
}

#[tauri::command]
pub async fn updates_check(app: AppHandle) {
    check(&app, true).await;
}

#[tauri::command]
pub async fn updates_install(app: AppHandle) -> Result<(), String> {
    install(&app).await
}

/// The tray item: installs when a version is known, looks for one otherwise.
pub fn tray_clicked(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        if state().update.is_some() {
            let _ = install(&app).await;
        } else {
            check(&app, true).await;
            if state().status.available.is_none() {
                // Nothing new: the settings' About page says so.
                crate::settings::open_window_at(&app, Some("about"));
            }
        }
    });
}
