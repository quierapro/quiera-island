//! Quick controls: Wi-Fi and Bluetooth, the audio output, the master
//! volume and each app's volume. The tab reads them while it is open; the
//! commands run off the main thread, as the system calls behind them can
//! take a moment.

use std::collections::HashMap;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex};

use serde::{Deserialize, Serialize};
use tauri::http::{Response, StatusCode, header};

use crate::peeks::DeviceForm;
use crate::{platform, protocol};

pub const APP_ICON_SCHEME: &str = "quiera-app";
const ICON_SIZE: u32 = 32;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RadioKind {
    Wifi,
    Bluetooth,
}

/// What the platform reads.
pub struct RawControls {
    pub radios: Vec<(RadioKind, bool)>,
    pub outputs: Vec<RawOutput>,
    /// Level 0–100 and mute, when there is an output.
    pub master: Option<(u8, bool)>,
    pub apps: Vec<RawApp>,
}

pub struct RawOutput {
    pub id: String,
    pub short: String,
    pub full: String,
    pub desc: String,
    pub form: DeviceForm,
    pub default: bool,
}

pub struct RawApp {
    pub path: PathBuf,
    pub name: String,
    pub level: u8,
    pub muted: bool,
}

/// Mirrors `Controls` in `src/ipc/controls.ts`.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Controls {
    pub radios: Vec<Radio>,
    pub outputs: Vec<Output>,
    pub volume: Option<Level>,
    pub apps: Vec<App>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Radio {
    pub kind: RadioKind,
    pub on: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Output {
    pub id: String,
    pub name: String,
    pub form: DeviceForm,
    pub default: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Level {
    pub level: u8,
    pub muted: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct App {
    /// Stable for the app (from its path): what the commands take.
    pub key: String,
    pub name: String,
    pub icon: String,
    pub level: u8,
    pub muted: bool,
}

/// App paths by key, so commands never take a path from the page.
static APPS: LazyLock<Mutex<HashMap<String, PathBuf>>> = LazyLock::new(Mutex::default);
/// App icons (PNG) by key; None when the shell had none.
static ICONS: LazyLock<Mutex<HashMap<String, Option<Vec<u8>>>>> = LazyLock::new(Mutex::default);

fn key_of(path: &Path) -> String {
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// "Voicemeeter Input (VB-Audio Voicemeeter VAIO)": the endpoint's own
/// description with its device, or the full name without one.
fn described(o: &RawOutput) -> String {
    match o.desc.as_str() {
        "" => o.full.clone(),
        desc => format!("{desc} ({})", o.short),
    }
}

/// Output names: the device's short name, unless another output shares it
/// (the speakers and headphones of one sound card): then the full name,
/// then the description with the device (virtual cables), then a number.
pub fn output_names(outputs: &[RawOutput]) -> Vec<String> {
    let short = |o: &RawOutput| o.short.clone();
    let full = |o: &RawOutput| o.full.clone();
    let levels: [&dyn Fn(&RawOutput) -> String; 3] = [&short, &full, &described];
    let mut names: Vec<String> = outputs
        .iter()
        .map(|o| {
            levels
                .iter()
                .map(|name| (name(o), name))
                .find(|(n, name)| outputs.iter().filter(|x| name(x) == *n).count() == 1)
                .map_or_else(|| described(o), |(n, _)| n)
        })
        .collect();
    // Still twins: number them.
    let original = names.clone();
    for (i, name) in names.iter_mut().enumerate() {
        if original.iter().filter(|n| *n == name).count() > 1 {
            let nth = original[..i].iter().filter(|n| *n == name).count() + 1;
            *name = format!("{name} {nth}");
        }
    }
    names
}

fn build(raw: RawControls) -> Controls {
    let names = output_names(&raw.outputs);
    let mut outputs: Vec<Output> = raw
        .outputs
        .into_iter()
        .zip(names)
        .map(|(o, name)| Output {
            id: o.id,
            name,
            form: o.form,
            default: o.default,
        })
        .collect();
    // The one in use first: it is the one people look for.
    outputs.sort_by_key(|o| !o.default);
    let mut radios = raw.radios;
    radios.sort_by_key(|(kind, _)| *kind != RadioKind::Wifi);
    let mut known = APPS.lock().unwrap_or_else(|e| e.into_inner());
    let apps = raw
        .apps
        .into_iter()
        .map(|a| {
            let key = key_of(&a.path);
            known.insert(key.clone(), a.path);
            App {
                icon: protocol::url(APP_ICON_SCHEME, &key),
                key,
                name: a.name,
                level: a.level,
                muted: a.muted,
            }
        })
        .collect();
    Controls {
        radios: radios
            .into_iter()
            .map(|(kind, on)| Radio { kind, on })
            .collect(),
        outputs,
        volume: raw.master.map(|(level, muted)| Level { level, muted }),
        apps,
    }
}

fn app_path(key: &str) -> Result<PathBuf, String> {
    APPS.lock()
        .unwrap_or_else(|e| e.into_inner())
        .get(key)
        .cloned()
        .ok_or_else(|| "unknown app".into())
}

#[tauri::command]
pub async fn controls_state() -> Controls {
    build(platform::read_controls())
}

#[tauri::command]
pub async fn controls_set_radio(kind: RadioKind, on: bool) -> Result<(), String> {
    platform::set_radio(kind, on)
}

#[tauri::command]
pub async fn controls_set_output(id: String) -> Result<(), String> {
    platform::set_default_output(&id)
}

#[tauri::command]
pub async fn controls_set_volume(level: u8) -> Result<(), String> {
    platform::set_master_volume(level)
}

#[tauri::command]
pub async fn controls_set_mute(muted: bool) -> Result<(), String> {
    platform::set_master_mute(muted)
}

#[tauri::command]
pub async fn controls_set_app_volume(key: String, level: u8) -> Result<(), String> {
    platform::set_app_volume(&app_path(&key)?, level)
}

#[tauri::command]
pub async fn controls_set_app_mute(key: String, muted: bool) -> Result<(), String> {
    platform::set_app_mute(&app_path(&key)?, muted)
}

/// Serves an app's icon (`/<key>`), read from the shell once per app.
pub fn serve_icon(path: &str, responder: tauri::UriSchemeResponder) {
    let key = path.trim_start_matches('/').to_owned();
    std::thread::spawn(move || {
        let cached = ICONS
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .get(&key)
            .cloned();
        let png = cached.unwrap_or_else(|| {
            let png = app_path(&key)
                .ok()
                .and_then(|p| platform::file_thumbnail(&p, ICON_SIZE));
            ICONS
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .insert(key.clone(), png.clone());
            png
        });
        let response = match png {
            Some(png) => Response::builder()
                .header(header::CONTENT_TYPE, "image/png")
                .header(header::CACHE_CONTROL, "max-age=3600")
                .body(png),
            None => Response::builder()
                .status(StatusCode::NOT_FOUND)
                .body(Vec::new()),
        };
        responder.respond(response.unwrap_or_else(|_| Response::new(Vec::new())));
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn output(short: &str, full: &str) -> RawOutput {
        with_desc(short, full, "")
    }

    fn with_desc(short: &str, full: &str, desc: &str) -> RawOutput {
        RawOutput {
            id: full.into(),
            short: short.into(),
            full: full.into(),
            desc: desc.into(),
            form: DeviceForm::Other,
            default: false,
        }
    }

    #[test]
    fn short_names_unless_two_outputs_share_one() {
        let outputs = [
            output("Realtek(R) Audio", "Haut-parleurs (Realtek(R) Audio)"),
            output("Realtek(R) Audio", "Casque (Realtek(R) Audio)"),
            output("WH-1000XM4", "Casque (WH-1000XM4 Stereo)"),
        ];
        assert_eq!(
            output_names(&outputs),
            [
                "Haut-parleurs (Realtek(R) Audio)",
                "Casque (Realtek(R) Audio)",
                "WH-1000XM4"
            ]
        );
    }

    #[test]
    fn virtual_cables_with_one_name_get_their_description_or_a_number() {
        let vm = "Haut-parleurs (VB-Audio Voicemeeter VAIO)";
        let device = "VB-Audio Voicemeeter VAIO";
        let outputs = [
            with_desc(device, vm, "Voicemeeter Input"),
            with_desc(device, vm, "Voicemeeter AUX Input"),
            with_desc(device, vm, ""),
            with_desc(device, vm, ""),
            output("WH-CH520", "Casque (WH-CH520)"),
        ];
        assert_eq!(
            output_names(&outputs),
            [
                format!("Voicemeeter Input ({device})"),
                format!("Voicemeeter AUX Input ({device})"),
                format!("{vm} 1"),
                format!("{vm} 2"),
                "WH-CH520".into(),
            ]
        );
    }

    #[test]
    fn apps_get_a_stable_key_and_commands_resolve_it() {
        let mut speakers = output("Realtek(R) Audio", "Haut-parleurs (Realtek(R) Audio)");
        let mut headphones = output("WH-CH520", "Casque (WH-CH520)");
        speakers.default = false;
        headphones.default = true;
        let controls = build(RawControls {
            radios: vec![(RadioKind::Bluetooth, true), (RadioKind::Wifi, true)],
            outputs: vec![speakers, headphones],
            master: Some((40, false)),
            apps: vec![RawApp {
                path: PathBuf::from(r"C:\Apps\Spotify.exe"),
                name: "Spotify".into(),
                level: 80,
                muted: false,
            }],
        });
        let key = &controls.apps[0].key;
        assert_eq!(key, &key_of(Path::new(r"C:\Apps\Spotify.exe")));
        assert_eq!(
            app_path(key).unwrap(),
            PathBuf::from(r"C:\Apps\Spotify.exe")
        );
        assert!(app_path("nope").is_err());
        assert_eq!(
            controls.volume,
            Some(Level {
                level: 40,
                muted: false
            })
        );
        assert_eq!(
            controls.outputs[0].name, "WH-CH520",
            "the output in use first"
        );
        assert_eq!(controls.radios[0].kind, RadioKind::Wifi, "Wi-Fi first");
    }
}
