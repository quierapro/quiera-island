//! Plugins: folders in the app's data folder (`plugins/<name>/`), each with
//! a `quiera-plugin.json` and its code. A plugin runs only once enabled in
//! the settings, which also keep the network hosts people agreed to: one
//! that asks for more after an update waits for a new consent.
//!
//! Every plugin speaks the same protocol (`protocol.rs`) whatever runs it;
//! the limits all plugins share (sizes, how often they may peek) are kept
//! here, as their messages arrive. Only JavaScript runs for now.
//!
//! For now every plugin is local (developer mode); the signed catalog comes
//! later. A change to a running plugin's files restarts it, so its author
//! sees it at once.

mod manifest;
mod net;
mod protocol;
mod runtime;

use std::collections::{BTreeMap, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{Duration, Instant, SystemTime};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use manifest::{Manifest, RuntimeKind, TabSpec};
use protocol::{Level, ToPlugin, ToQuiera};
use runtime::{Out, Plugin};

pub const LIST_EVENT: &str = "plugins://list";
pub const VIEWS_EVENT: &str = "plugins://views";
pub const PEEK_EVENT: &str = "plugins://peek";
const LOG_LINES: usize = 200;
const LOG_TEXT: usize = 2000;
/// A tab or an activity larger than this is not shown.
const MAX_VIEW: usize = 64 << 10;
/// A plugin may peek once in this long.
const PEEK_EVERY: Duration = Duration::from_secs(10);
const WATCH_EVERY: Duration = Duration::from_millis(1500);

/// A plugin found on disk, as the settings show it.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginInfo {
    /// The manifest's id, or the folder's name when the manifest is unreadable.
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: String,
    pub icon: String,
    pub network: Vec<String>,
    pub tab: Option<TabSpec>,
    pub folder: String,
    pub enabled: bool,
    pub running: bool,
    /// Its permissions grew since they were agreed to: it waits for consent.
    pub needs_consent: bool,
    pub error: Option<String>,
}

/// What a running plugin shows, for the island.
#[derive(Debug, Clone, Default, Serialize)]
pub struct PluginView {
    pub id: String,
    pub tab: Option<serde_json::Value>,
    pub activity: Option<serde_json::Value>,
}

impl PluginView {
    fn new(id: &str) -> Self {
        PluginView {
            id: id.to_owned(),
            ..PluginView::default()
        }
    }
}

/// One line of a plugin's console, for its author.
#[derive(Debug, Clone, Serialize)]
pub struct LogLine {
    /// Milliseconds since 1970.
    pub at: u64,
    pub level: Level,
    pub text: String,
}

struct Found {
    folder: PathBuf,
    manifest: Result<Manifest, String>,
    /// When its files last changed, to restart it on an edit.
    stamp: Option<SystemTime>,
}

struct Running {
    plugin: Plugin,
    stamp: Option<SystemTime>,
    last_peek: Option<Instant>,
}

#[derive(Default)]
struct Registry {
    found: Vec<Found>,
    running: BTreeMap<String, Running>,
    views: BTreeMap<String, PluginView>,
    logs: BTreeMap<String, VecDeque<LogLine>>,
    /// Stopped by itself (error, too slow): not restarted until its files change.
    failed: BTreeMap<String, (String, Option<SystemTime>)>,
}

static REGISTRY: LazyLock<Mutex<Registry>> = LazyLock::new(Mutex::default);

fn registry() -> std::sync::MutexGuard<'static, Registry> {
    REGISTRY.lock().unwrap_or_else(|e| e.into_inner())
}

/// Where plugins live: `%APPDATA%\<app>\plugins`.
fn plugins_dir(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join("plugins"))
}

fn storage_path(app: &AppHandle, id: &str) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|d| d.join("plugin-data").join(format!("{id}.json")))
}

/// The latest change among a folder's manifest and entry file.
fn stamp(folder: &Path, main: Option<&str>) -> Option<SystemTime> {
    let times = [Some(manifest::FILE), main]
        .into_iter()
        .flatten()
        .filter_map(|f| std::fs::metadata(folder.join(f)).ok()?.modified().ok());
    times.max()
}

fn scan(dir: &Path) -> Vec<Found> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut found: Vec<Found> = entries
        .flatten()
        .filter(|e| e.file_type().is_ok_and(|t| t.is_dir()))
        .map(|e| {
            let folder = e.path();
            let manifest = std::fs::read_to_string(folder.join(manifest::FILE))
                .map_err(|_| format!("no {} in this folder", manifest::FILE))
                .and_then(|json| Manifest::parse(&json));
            let main = manifest.as_ref().ok().map(|m| m.main.clone());
            let stamp = stamp(&folder, main.as_deref());
            Found {
                folder,
                manifest,
                stamp,
            }
        })
        .collect();
    found.sort_by(|a, b| a.folder.cmp(&b.folder));
    // Two folders with one id: the second is refused.
    let mut seen = std::collections::BTreeSet::new();
    for f in &mut found {
        if let Ok(m) = &f.manifest
            && !seen.insert(m.id.clone())
        {
            f.manifest = Err(format!("another folder already has the id \"{}\"", m.id));
        }
    }
    found
}

/// Whether every host it asks for was agreed to.
fn consented(m: &Manifest, approved: &BTreeMap<String, Vec<String>>) -> bool {
    let agreed = approved.get(&m.id);
    m.permissions
        .network
        .iter()
        .all(|h| agreed.is_some_and(|a| a.contains(h)))
}

fn push_log(reg: &mut Registry, id: &str, level: Level, text: &str) {
    let lines = reg.logs.entry(id.to_owned()).or_default();
    let at = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    if lines.len() >= LOG_LINES {
        lines.pop_front();
    }
    lines.push_back(LogLine {
        at,
        level,
        text: text.chars().take(LOG_TEXT).collect(),
    });
}

fn emit_views(app: &AppHandle, reg: &Registry) {
    let views: Vec<&PluginView> = reg
        .views
        .values()
        .filter(|v| reg.running.contains_key(&v.id))
        .collect();
    let _ = app.emit(VIEWS_EVENT, views);
}

fn infos(reg: &Registry) -> Vec<PluginInfo> {
    let settings = crate::settings::get();
    let plugins = &settings.plugins;
    reg.found
        .iter()
        .map(|f| {
            let folder_name = f
                .folder
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default();
            match &f.manifest {
                Ok(m) => PluginInfo {
                    id: m.id.clone(),
                    name: m.name.clone(),
                    version: m.version.clone(),
                    author: m.author.clone(),
                    description: m.description.clone(),
                    icon: m.icon.clone(),
                    network: m.permissions.network.clone(),
                    tab: m.tab,
                    folder: folder_name,
                    enabled: plugins.enabled.contains(&m.id),
                    running: reg.running.contains_key(&m.id),
                    needs_consent: plugins.enabled.contains(&m.id)
                        && !consented(m, &plugins.approved),
                    error: reg.failed.get(&m.id).map(|(e, _)| e.clone()),
                },
                Err(e) => PluginInfo {
                    id: folder_name.clone(),
                    name: folder_name.clone(),
                    version: String::new(),
                    author: String::new(),
                    description: String::new(),
                    icon: "🧩".into(),
                    network: Vec::new(),
                    tab: None,
                    folder: folder_name,
                    enabled: false,
                    running: false,
                    needs_consent: false,
                    error: Some(e.clone()),
                },
            }
        })
        .collect()
}

/// Whether a view fits the limit; one that does not is reported.
fn fits(reg: &mut Registry, id: &str, what: &str, value: &Option<serde_json::Value>) -> bool {
    let size = value.as_ref().map_or(0, |v| v.to_string().len());
    if size <= MAX_VIEW {
        return true;
    }
    push_log(
        reg,
        id,
        Level::Error,
        &format!("{what} larger than 64 KB: not shown"),
    );
    false
}

/// What a plugin sends, checked against the limits every plugin shares,
/// then applied to the registry and passed on to the island.
fn receive(app: &AppHandle, id: &str, out: Out) {
    let mut reg = registry();
    // A message from a plugin stopped meanwhile (an edit, turned off) is dropped.
    if !reg.running.contains_key(id) && !matches!(out, Out::Failed(_)) {
        return;
    }
    match out {
        Out::Message(ToQuiera::Render { tree }) => {
            if !fits(&mut reg, id, "the tab", &tree) {
                return;
            }
            reg.views
                .entry(id.to_owned())
                .or_insert_with(|| PluginView::new(id))
                .tab = tree;
            emit_views(app, &reg);
        }
        Out::Message(ToQuiera::Activity { activity }) => {
            if !fits(&mut reg, id, "the activity", &activity) {
                return;
            }
            reg.views
                .entry(id.to_owned())
                .or_insert_with(|| PluginView::new(id))
                .activity = activity;
            emit_views(app, &reg);
        }
        Out::Message(ToQuiera::Peek { peek }) => {
            let now = Instant::now();
            let Some(running) = reg.running.get_mut(id) else {
                return;
            };
            if running.last_peek.is_some_and(|at| now - at < PEEK_EVERY) {
                push_log(
                    &mut reg,
                    id,
                    Level::Warn,
                    "peek ignored: at most one every 10 seconds",
                );
            } else if fits(&mut reg, id, "the peek", &Some(peek.clone())) {
                if let Some(running) = reg.running.get_mut(id) {
                    running.last_peek = Some(now);
                }
                let _ = app.emit(PEEK_EVENT, serde_json::json!({ "id": id, "peek": peek }));
            }
        }
        Out::Message(ToQuiera::Log { level, text }) => push_log(&mut reg, id, level, &text),
        Out::Failed(error) => {
            push_log(&mut reg, id, Level::Error, &error);
            let stamp = reg.running.get(id).and_then(|r| r.stamp);
            reg.running.remove(id);
            reg.views.remove(id);
            reg.failed.insert(id.to_owned(), (error, stamp));
            emit_views(app, &reg);
            let _ = app.emit(LIST_EVENT, infos(&reg));
        }
    }
}

/// Brings the running plugins in line with the disk and the settings:
/// starts the enabled ones, stops the others, restarts the edited ones.
pub fn sync(app: &AppHandle) {
    let Some(dir) = plugins_dir(app) else {
        return;
    };
    let found = scan(&dir);
    let settings = crate::settings::get();
    let mut reg = registry();
    reg.found = found;

    let wanted: BTreeMap<String, (Manifest, PathBuf, Option<SystemTime>)> = reg
        .found
        .iter()
        .filter_map(|f| {
            let m = f.manifest.as_ref().ok()?;
            (settings.plugins.enabled.contains(&m.id) && consented(m, &settings.plugins.approved))
                .then(|| (m.id.clone(), (m.clone(), f.folder.clone(), f.stamp)))
        })
        .collect();

    // Stopped: no longer wanted, or edited (restarted below).
    let stale: Vec<String> = reg
        .running
        .iter()
        .filter(|(id, r)| {
            wanted
                .get(*id)
                .is_none_or(|(_, _, stamp)| *stamp != r.stamp)
        })
        .map(|(id, _)| id.clone())
        .collect();
    for id in stale {
        reg.running.remove(&id);
        reg.views.remove(&id);
    }
    // A failed plugin waits for an edit of its files.
    reg.failed
        .retain(|id, (_, stamp)| wanted.get(id).is_some_and(|(_, _, s)| s == stamp));

    for (id, (manifest, folder, stamp)) in wanted {
        if reg.running.contains_key(&id) || reg.failed.contains_key(&id) {
            continue;
        }
        if manifest.runtime != RuntimeKind::Js {
            let error = format!(
                "the \"{}\" runtime comes in a later version of Quiera",
                manifest.runtime.name()
            );
            push_log(&mut reg, &id, Level::Error, &error);
            reg.failed.insert(id, (error, stamp));
            continue;
        }
        let source = match std::fs::read_to_string(folder.join(&manifest.main)) {
            Ok(s) => s,
            Err(e) => {
                let error = format!("{}: {e}", manifest.main);
                push_log(&mut reg, &id, Level::Error, &error);
                reg.failed.insert(id, (error, stamp));
                continue;
            }
        };
        let Some(storage) = storage_path(app, &id) else {
            continue;
        };
        push_log(
            &mut reg,
            &id,
            Level::Info,
            &format!("started (version {})", manifest.version),
        );
        let handle = app.clone();
        let for_id = id.clone();
        let plugin = Plugin::start(
            manifest,
            source,
            storage,
            Arc::new(move |out| receive(&handle, &for_id, out)),
        );
        reg.running.insert(
            id,
            Running {
                plugin,
                stamp,
                last_peek: None,
            },
        );
    }
    emit_views(app, &reg);
    let _ = app.emit(LIST_EVENT, infos(&reg));
}

/// At start: the folder exists, enabled plugins run, and edits are watched.
pub fn start(app: &AppHandle) {
    if let Some(dir) = plugins_dir(app) {
        let _ = std::fs::create_dir_all(&dir);
    }
    sync(app);
    let app = app.clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(WATCH_EVERY);
            let Some(dir) = plugins_dir(&app) else {
                continue;
            };
            let now: Vec<(PathBuf, Option<SystemTime>)> = scan(&dir)
                .into_iter()
                .map(|f| (f.folder, f.stamp))
                .collect();
            let before: Vec<(PathBuf, Option<SystemTime>)> = registry()
                .found
                .iter()
                .map(|f| (f.folder.clone(), f.stamp))
                .collect();
            if now != before {
                sync(&app);
            }
        }
    });
}

#[tauri::command]
pub fn plugins_list() -> Vec<PluginInfo> {
    infos(&registry())
}

#[tauri::command]
pub fn plugins_views() -> Vec<PluginView> {
    let reg = registry();
    reg.views
        .values()
        .filter(|v| reg.running.contains_key(&v.id))
        .cloned()
        .collect()
}

/// The island tells a plugin its tab opened or closed, or a control was used.
#[tauri::command]
pub fn plugin_event(
    id: String,
    kind: String,
    action: Option<String>,
    value: Option<serde_json::Value>,
) -> Result<(), String> {
    let reg = registry();
    let Some(running) = reg.running.get(&id) else {
        return Ok(());
    };
    let message = match kind.as_str() {
        "open" => ToPlugin::Open,
        "close" => ToPlugin::Close,
        "action" => ToPlugin::Action {
            action: action.unwrap_or_default(),
            value,
        },
        _ => return Err(format!("unknown event {kind}")),
    };
    running.plugin.send(message);
    Ok(())
}

#[tauri::command]
pub fn plugin_logs(id: String) -> Vec<LogLine> {
    registry()
        .logs
        .get(&id)
        .map(|l| l.iter().cloned().collect())
        .unwrap_or_default()
}

/// Opens the plugins folder in the Explorer.
#[tauri::command]
pub fn plugins_open_folder(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let dir = plugins_dir(&app).ok_or("no data folder")?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    app.opener()
        .open_path(dir.to_string_lossy(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn manifest(network: &[&str]) -> Manifest {
        let hosts: Vec<String> = network.iter().map(|h| format!("\"{h}\"")).collect();
        Manifest::parse(&format!(
            r#"{{ "id": "weather", "name": "Météo", "version": "1", "permissions": {{ "network": [{}] }} }}"#,
            hosts.join(",")
        ))
        .unwrap()
    }

    #[test]
    fn runs_only_with_every_host_agreed_to() {
        let mut approved = BTreeMap::new();
        assert!(consented(&manifest(&[]), &approved));
        assert!(!consented(&manifest(&["api.open-meteo.com"]), &approved));
        approved.insert("weather".to_owned(), vec!["api.open-meteo.com".to_owned()]);
        assert!(consented(&manifest(&["api.open-meteo.com"]), &approved));
        // An update asks for one more: consent again.
        assert!(!consented(
            &manifest(&["api.open-meteo.com", "evil.com"]),
            &approved
        ));
    }
}
