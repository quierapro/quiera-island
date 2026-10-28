//! System peeks: short announcements the island shows when something
//! happens on the computer (charger plugged, headphones connected, Caps Lock,
//! volume). The platform reports changes; this module decides what is worth
//! showing and sends it to the UI.

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::clipboard::ClipKind;
use crate::platform;

pub const PEEK_EVENT: &str = "system://peek";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DeviceForm {
    Headphones,
    Headset,
    Speakers,
    Other,
}

/// Mirrors `SystemPeek` in `src/ipc/peeks.ts`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SystemPeek {
    /// The charger was plugged in or out.
    #[serde(rename_all = "camelCase")]
    Power { plugged: bool, percent: Option<u8> },
    /// A new audio output became the default (headphones connected…).
    #[serde(rename_all = "camelCase")]
    AudioDevice {
        name: String,
        form: DeviceForm,
        battery: Option<u8>,
    },
    #[serde(rename_all = "camelCase")]
    CapsLock { on: bool },
    /// Master volume, 0–100.
    #[serde(rename_all = "camelCase")]
    Volume { level: u8, muted: bool },
    /// Something was copied: the start of the text, or the image.
    #[serde(rename_all = "camelCase")]
    Copied {
        content: ClipKind,
        preview: String,
        thumbnail: Option<String>,
    },
    /// A notification arrived.
    #[serde(rename_all = "camelCase")]
    Notification {
        id: u32,
        app: String,
        title: String,
        body: String,
        icon: Option<String>,
    },
}

/// A raw power reading from the platform.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PowerReading {
    pub has_battery: bool,
    pub plugged: bool,
    pub percent: Option<u8>,
}

/// Only a change of plug state on a computer with a battery is worth a peek:
/// Windows also reports every percent drop, and desktops are always plugged.
pub fn power_peek(previous: Option<PowerReading>, now: PowerReading) -> Option<SystemPeek> {
    let previous = previous?;
    (now.has_battery && previous.plugged != now.plugged).then_some(SystemPeek::Power {
        plugged: now.plugged,
        percent: now.percent,
    })
}

/// Windows reports volume as 0.0–1.0.
pub fn volume_percent(scalar: f32) -> u8 {
    (scalar.clamp(0.0, 1.0) * 100.0).round() as u8
}

pub fn start(handle: &AppHandle) {
    let handle = handle.clone();
    platform::start_peek_watch(move |peek| announce(&handle, peek));
}

/// Shows a peek on the island.
pub fn announce(app: &AppHandle, peek: SystemPeek) {
    // Volume changes come in bursts; copies and notifications are private.
    if !matches!(
        peek,
        SystemPeek::Volume { .. } | SystemPeek::Copied { .. } | SystemPeek::Notification { .. }
    ) {
        log::info!("system peek: {}", kind_name(&peek));
    }
    if let Err(e) = app.emit(PEEK_EVENT, peek) {
        log::warn!("could not send a system peek: {e}");
    }
}

/// For the log: the kind only, never device names.
fn kind_name(peek: &SystemPeek) -> &'static str {
    match peek {
        SystemPeek::Power { .. } => "power",
        SystemPeek::AudioDevice { .. } => "audio device",
        SystemPeek::CapsLock { .. } => "caps lock",
        SystemPeek::Volume { .. } => "volume",
        SystemPeek::Copied { .. } => "copied",
        SystemPeek::Notification { .. } => "notification",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reading(plugged: bool) -> PowerReading {
        PowerReading {
            has_battery: true,
            plugged,
            percent: Some(72),
        }
    }

    #[test]
    fn announces_the_charger_being_plugged_in_and_out() {
        assert_eq!(
            power_peek(Some(reading(false)), reading(true)),
            Some(SystemPeek::Power {
                plugged: true,
                percent: Some(72)
            })
        );
        assert!(matches!(
            power_peek(Some(reading(true)), reading(false)),
            Some(SystemPeek::Power { plugged: false, .. })
        ));
    }

    #[test]
    fn stays_quiet_at_startup_and_on_battery_level_changes() {
        assert_eq!(power_peek(None, reading(true)), None);
        assert_eq!(power_peek(Some(reading(true)), reading(true)), None);
    }

    #[test]
    fn stays_quiet_on_a_desktop_without_battery() {
        let desktop = |plugged| PowerReading {
            has_battery: false,
            plugged,
            percent: None,
        };
        assert_eq!(power_peek(Some(desktop(false)), desktop(true)), None);
    }

    #[test]
    fn rounds_and_bounds_the_volume() {
        assert_eq!(volume_percent(0.555), 56);
        assert_eq!(volume_percent(1.2), 100);
        assert_eq!(volume_percent(-0.1), 0);
    }

    #[test]
    fn serializes_with_the_shape_the_frontend_expects() {
        let json = serde_json::to_value(SystemPeek::AudioDevice {
            name: "Casque".into(),
            form: DeviceForm::Headphones,
            battery: Some(72),
        })
        .unwrap();
        assert_eq!(
            json,
            serde_json::json!({ "kind": "audioDevice", "name": "Casque", "form": "headphones", "battery": 72 })
        );
        let json = serde_json::to_value(SystemPeek::CapsLock { on: true }).unwrap();
        assert_eq!(json, serde_json::json!({ "kind": "capsLock", "on": true }));
    }
}
