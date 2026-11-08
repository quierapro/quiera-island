//! Settings: what people choose in the settings window, kept in
//! `settings.json` in the app's config folder and applied as soon as they
//! change, without a restart.
//!
//! Every field has a default, so an older file (or one missing fields) still
//! loads; a file that cannot be read at all is set aside, not lost, and the
//! defaults take over. Writes go to a temporary file first, then replace the
//! old one: a crash mid-write never leaves half a file.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{LazyLock, RwLock};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

pub const CHANGED_EVENT: &str = "settings://changed";
const FILE: &str = "settings.json";
/// Bumped when a field changes meaning; `migrate` brings older files up.
pub const VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    pub version: u32,
    pub general: General,
    pub tabs: Tabs,
    pub calendar: Calendar,
    pub agents: Agents,
    pub launcher: Launcher,
    pub media: Media,
    pub notifications: Notifications,
    pub clipboard: Clipboard,
    pub peeks: Peeks,
    pub shelf: Shelf,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            version: VERSION,
            general: General::default(),
            tabs: Tabs::default(),
            calendar: Calendar::default(),
            agents: Agents::default(),
            launcher: Launcher::default(),
            media: Media::default(),
            notifications: Notifications::default(),
            clipboard: Clipboard::default(),
            peeks: Peeks::default(),
            shelf: Shelf::default(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Motion {
    /// Follows Windows' "Animation effects" setting.
    #[default]
    System,
    Reduced,
    Full,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct General {
    pub start_with_windows: bool,
    /// The monitor's name; None for the primary monitor.
    pub screen: Option<String>,
    pub hide_in_fullscreen: bool,
    /// Opens the panel on hover; otherwise on click.
    pub open_on_hover: bool,
    /// Closed, the island lets clicks go to the window under it (a browser's
    /// tabs); it opens when the pointer rests on it.
    pub pass_through: bool,
    /// Shows and hides the island from the keyboard.
    #[serde(deserialize_with = "lenient_hotkey")]
    pub island_shortcut: Hotkey,
    pub motion: Motion,
    /// Looks for a new version now and then (GitHub releases).
    pub check_updates: bool,
    pub language: Language,
}

/// The interface's language.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    /// Windows' display language: French for French, English otherwise.
    #[default]
    System,
    Fr,
    En,
}

impl Default for General {
    fn default() -> Self {
        Self {
            start_with_windows: false,
            screen: None,
            hide_in_fullscreen: true,
            open_on_hover: true,
            pass_through: true,
            island_shortcut: Hotkey::default(),
            motion: Motion::System,
            check_updates: true,
            language: Language::System,
        }
    }
}

/// The launcher's shortcut.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
pub enum Shortcut {
    #[default]
    #[serde(rename = "Alt+Espace")]
    AltSpace,
    #[serde(rename = "Ctrl+Alt+Espace")]
    CtrlAltSpace,
    #[serde(rename = "Ctrl+Maj+Espace")]
    CtrlShiftSpace,
    #[serde(rename = "Alt+Q")]
    AltQ,
}

/// A shortcut people record themselves: modifiers and one key (Windows'
/// virtual-key code; 0 for none), with its name as they saw it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Hotkey {
    pub ctrl: bool,
    pub alt: bool,
    pub shift: bool,
    pub win: bool,
    pub key: u32,
    pub label: String,
    /// A key alone pressed twice in a row (Ctrl, Ctrl).
    pub double: bool,
}

impl Hotkey {
    pub fn none() -> Self {
        Hotkey {
            ctrl: false,
            alt: false,
            shift: false,
            win: false,
            key: 0,
            label: String::new(),
            double: false,
        }
    }

    pub fn is_none(&self) -> bool {
        self.key == 0
    }
}

/// Ctrl+Alt+I.
impl Default for Hotkey {
    fn default() -> Self {
        Hotkey {
            ctrl: true,
            alt: true,
            key: u32::from(b'I'),
            label: "Ctrl+Alt+I".into(),
            ..Hotkey::none()
        }
    }
}

/// A shortcut as recorded, or the default for anything else (an older
/// file's text): one unreadable field must not set the whole file aside.
fn lenient_hotkey<'de, D: serde::Deserializer<'de>>(deserializer: D) -> Result<Hotkey, D::Error> {
    let value = serde_json::Value::deserialize(deserializer)?;
    Ok(match value {
        serde_json::Value::String(s) if s == "off" => Hotkey::none(),
        other => serde_json::from_value(other).unwrap_or_default(),
    })
}

impl Shortcut {
    pub const ALL: [Shortcut; 4] = [
        Shortcut::AltSpace,
        Shortcut::CtrlAltSpace,
        Shortcut::CtrlShiftSpace,
        Shortcut::AltQ,
    ];
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Launcher {
    pub enabled: bool,
    pub shortcut: Shortcut,
    pub index_files: bool,
}

impl Default for Launcher {
    fn default() -> Self {
        Self {
            enabled: true,
            shortcut: Shortcut::AltSpace,
            index_files: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Media {
    pub lyrics: bool,
    /// Word-by-word lyrics from NetEase (an unofficial API): off unless
    /// chosen. LRCLIB, open and official, is used either way.
    pub netease: bool,
    /// Moves lyrics earlier (negative) or later (positive), in ms.
    pub lyrics_offset_ms: i32,
}

impl Default for Media {
    fn default() -> Self {
        Self {
            lyrics: true,
            netease: false,
            lyrics_offset_ms: 0,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Notifications {
    pub enabled: bool,
    /// Announces each one on the island (else only in the tab).
    pub peek: bool,
}

impl Default for Notifications {
    fn default() -> Self {
        Self {
            enabled: true,
            peek: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Clipboard {
    pub enabled: bool,
}

impl Default for Clipboard {
    fn default() -> Self {
        Self { enabled: true }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Peeks {
    pub power: bool,
    pub audio_device: bool,
    /// Bluetooth devices connecting with their battery, and low batteries.
    pub bluetooth: bool,
    pub caps_lock: bool,
    pub volume: bool,
}

impl Default for Peeks {
    fn default() -> Self {
        Self {
            power: true,
            audio_device: true,
            bluetooth: true,
            caps_lock: true,
            volume: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct Shelf {
    /// Keeps the shelf's files (their paths) from one session to the next.
    pub keep: bool,
}

/// The island's tabs: in which order, and which are hidden. Ids are
/// strings: one this version does not know (from a newer one) is kept, not
/// dropped. An empty order is the default one.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct Tabs {
    pub order: Vec<String>,
    pub hidden: Vec<String>,
}

/// The calendar: its iCal links (secret: never logged), and how long before
/// a meeting the island says so.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Calendar {
    pub links: Vec<String>,
    pub remind_minutes: u32,
}

impl Default for Calendar {
    fn default() -> Self {
        Self {
            links: Vec::new(),
            remind_minutes: 10,
        }
    }
}

/// AI agents: whether the island may answer their permissions, and whether
/// it already offered to listen to Claude Code (asked once, never again).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Agents {
    pub approve: bool,
    pub claude_asked: bool,
    /// Shows how much of each AI's usage limits is used.
    pub usage: bool,
    /// A sound when an agent has finished, or waits for its user.
    pub sound: bool,
}

impl Default for Agents {
    fn default() -> Self {
        Self {
            approve: true,
            claude_asked: false,
            usage: true,
            sound: true,
        }
    }
}

impl Settings {
    /// Brings values read from an older file up to date and into range.
    pub fn migrate(mut self) -> Self {
        // Version 1 is the first: nothing to bring up yet.
        self.version = VERSION;
        self.media.lyrics_offset_ms = self.media.lyrics_offset_ms.clamp(-5000, 5000);
        self.calendar.remind_minutes = self.calendar.remind_minutes.clamp(1, 60);
        self
    }
}

static SETTINGS: LazyLock<RwLock<Settings>> = LazyLock::new(RwLock::default);
/// No settings file at start: Quiera's first launch, which the island
/// welcomes. The file is written when the welcome ends, so it is said once.
static FIRST_LAUNCH: AtomicBool = AtomicBool::new(false);

/// The settings in force.
pub fn get() -> Settings {
    SETTINGS.read().unwrap_or_else(|e| e.into_inner()).clone()
}

fn path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|dir| dir.join(FILE))
}

/// Reads settings from `path`: defaults when there is no file, and when it
/// cannot be read the file is set aside (renamed) and defaults are used.
pub fn read(path: &Path) -> Settings {
    let Ok(text) = std::fs::read_to_string(path) else {
        return Settings::default();
    };
    match serde_json::from_str::<Settings>(&text) {
        Ok(settings) => settings.migrate(),
        Err(e) => {
            let aside = path.with_extension("unreadable.json");
            log::warn!("settings file unreadable ({e}); kept aside, defaults used");
            let _ = std::fs::rename(path, aside);
            Settings::default()
        }
    }
}

/// Writes settings to `path` through a temporary file.
pub fn write(path: &Path, settings: &Settings) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let text = serde_json::to_string_pretty(settings).map_err(std::io::Error::other)?;
    let temporary = path.with_extension("json.tmp");
    std::fs::write(&temporary, text)?;
    std::fs::rename(&temporary, path)
}

pub const WINDOW: &str = "settings";
/// Tells an open settings window which section to show.
pub const SECTION_EVENT: &str = "settings://section";

/// Opens the settings window, or brings it forward when already open.
pub fn open_window(app: &AppHandle) {
    open_window_at(app, None);
}

/// Opens the settings, on one section ("about") when given.
pub fn open_window_at(app: &AppHandle, section: Option<&str>) {
    if let Some(window) = app.get_webview_window(WINDOW) {
        let _ = window.unminimize();
        let _ = window.set_focus();
        if let Some(section) = section {
            let _ = window.emit(SECTION_EVENT, section);
        }
        return;
    }
    let page = match section {
        Some(section) => format!("settings.html#{section}"),
        None => "settings.html".to_owned(),
    };
    let built = tauri::WebviewWindowBuilder::new(app, WINDOW, tauri::WebviewUrl::App(page.into()))
        .title(crate::i18n::tr("Réglages de Quiera", "Quiera settings"))
        .inner_size(780.0, 560.0)
        .min_inner_size(680.0, 460.0)
        .theme(Some(tauri::Theme::Dark))
        // Its own title bar (SettingsApp): minimize and close, nothing else.
        .decorations(false)
        .maximizable(false)
        .center()
        .build();
    if let Err(e) = built {
        log::error!("could not open the settings: {e}");
    }
}

/// Async on purpose: on Windows, a window built from a synchronous command
/// never loads its page.
#[tauri::command]
pub async fn settings_open(app: AppHandle) {
    open_window(&app);
}

/// Loads the settings at start.
pub fn load(app: &AppHandle) {
    let file = path(app);
    FIRST_LAUNCH.store(
        file.as_ref().is_some_and(|f| !f.exists()),
        Ordering::Relaxed,
    );
    let settings = file.map(|p| read(&p)).unwrap_or_default();
    *SETTINGS.write().unwrap_or_else(|e| e.into_inner()) = settings;
}

/// Whether the island should welcome the user (first launch).
#[tauri::command]
pub fn welcome_needed() -> bool {
    FIRST_LAUNCH.load(Ordering::Relaxed)
}

/// The welcome ended (finished or skipped): the settings file is written,
/// so it does not come back.
#[tauri::command]
pub fn welcome_done(app: AppHandle) -> Result<(), String> {
    FIRST_LAUNCH.store(false, Ordering::Relaxed);
    match path(&app) {
        Some(file) if !file.exists() => {
            write(&file, &get()).map_err(|e| format!("could not save the settings: {e}"))
        }
        _ => Ok(()),
    }
}

#[tauri::command]
pub fn settings_get() -> Settings {
    get()
}

/// Saves new settings and applies what changed.
#[tauri::command]
pub fn settings_set(app: AppHandle, settings: Settings) -> Result<(), String> {
    let settings = settings.migrate();
    let previous = {
        let mut current = SETTINGS.write().unwrap_or_else(|e| e.into_inner());
        std::mem::replace(&mut *current, settings.clone())
    };
    if let Some(path) = path(&app) {
        write(&path, &settings).map_err(|e| format!("could not save the settings: {e}"))?;
    }
    crate::apply::changed(&app, &previous, &settings);
    let _ = app.emit(CHANGED_EVENT, &settings);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("quiera-settings-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir.join(FILE)
    }

    #[test]
    fn reads_a_recorded_shortcut_and_tolerates_old_text() {
        let mut settings = Settings::default();
        settings.general.island_shortcut = Hotkey {
            win: true,
            key: 0x78,
            label: "Win+F9".into(),
            ..Hotkey::none()
        };
        let json = serde_json::to_string(&settings).unwrap();
        let back: Settings = serde_json::from_str(&json).unwrap();
        assert_eq!(
            back.general.island_shortcut,
            settings.general.island_shortcut
        );
        // What a development build wrote before: the defaults, not an error.
        let old = r#"{ "general": { "islandShortcut": "Alt+Maj+Espace", "openOnHover": false } }"#;
        let read: Settings = serde_json::from_str(old).unwrap();
        assert_eq!(read.general.island_shortcut, Hotkey::default());
        assert!(!read.general.open_on_hover);
        let off: Settings =
            serde_json::from_str(r#"{ "general": { "islandShortcut": "off" } }"#).unwrap();
        assert!(off.general.island_shortcut.is_none());
    }

    #[test]
    fn defaults_without_a_file() {
        assert_eq!(read(&temp("none")), Settings::default());
    }

    #[test]
    fn round_trips_and_fills_missing_fields() {
        let path = temp("trip");
        let mut settings = Settings::default();
        settings.launcher.shortcut = Shortcut::AltQ;
        settings.media.netease = true;
        settings.tabs.order = vec!["timer".into(), "home".into(), "plugin:weather".into()];
        settings.tabs.hidden = vec!["clipboard".into()];
        write(&path, &settings).unwrap();
        assert_eq!(read(&path), settings);

        // An older file with fewer fields still loads, the rest defaulted.
        std::fs::write(&path, r#"{ "general": { "openOnHover": false } }"#).unwrap();
        let read_back = read(&path);
        assert!(!read_back.general.open_on_hover);
        assert!(read_back.general.hide_in_fullscreen);
        assert_eq!(read_back.version, VERSION);
        std::fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn sets_an_unreadable_file_aside() {
        let path = temp("broken");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, "{ not json").unwrap();
        assert_eq!(read(&path), Settings::default());
        assert!(!path.exists());
        assert!(path.with_extension("unreadable.json").exists());
        std::fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn keeps_values_in_range() {
        let mut settings = Settings::default();
        settings.media.lyrics_offset_ms = 99_999;
        assert_eq!(settings.migrate().media.lyrics_offset_ms, 5000);
    }

    #[test]
    fn writes_what_people_read() {
        let json = serde_json::to_value(Settings::default()).unwrap();
        assert_eq!(json["launcher"]["shortcut"], "Alt+Espace");
        assert_eq!(json["general"]["motion"], "system");
        assert_eq!(json["media"]["lyricsOffsetMs"], 0);
    }
}
