//! Bluetooth devices' batteries, read every 15 seconds from the properties
//! Windows keeps for each device: whether it is connected, and its battery
//! level (`DEVPKEY_Bluetooth_Battery`). A device that connects with a level
//! (keyboard, mouse, controller…) is announced with it, and so is one whose
//! battery runs low. Headphones are left to the audio device peek, which
//! already shows their battery when they become the output.
//!
//! Device names are shown on the island, never logged.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use windows::Devices::Enumeration::{DeviceInformation, DeviceInformationKind};
use windows::Foundation::IReference;
use windows::Win32::System::Com::{COINIT_MULTITHREADED, CoInitializeEx};
use windows::core::{GUID, HSTRING, Interface};
use windows_collections::IIterable;

use crate::peeks::{BluetoothKind, SystemPeek, battery_low};

const EVERY: Duration = Duration::from_secs(15);
/// After connecting, Windows may take a moment to learn the battery level.
const BATTERY_WAIT: Duration = Duration::from_secs(60);

const BLUETOOTH_CLASS: &str = "{e0cbf06c-cd8b-4647-bb8a-263b43f0f974}";
const BATTERY: &str = "{104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2";
const CONNECTED: &str = "{83DA6326-97A6-4088-9453-A1923F573B29} 15";
const CONTAINER: &str = "System.Devices.ContainerId";
const CLASS: &str = "System.Devices.ClassGuid";

const KEYBOARD_CLASS: &str = "4d36e96b-e325-11ce-bfc1-08002be10318";
const MOUSE_CLASS: &str = "4d36e96f-e325-11ce-bfc1-08002be10318";
const MEDIA_CLASS: &str = "4d36e96c-e325-11ce-bfc1-08002be10318";
const AUDIO_ENDPOINT_CLASS: &str = "c166523c-fe0c-4a94-a586-f1a80cfbbf3e";
const XBOX_CLASS: &str = "d61ca365-5af4-4486-998b-9db4734c6ca3";

/// A Bluetooth device as read at one moment.
struct Reading {
    container: GUID,
    name: String,
    connected: bool,
    battery: Option<u8>,
}

/// What is remembered of a device between readings.
struct Known {
    connected: bool,
    battery: Option<u8>,
    /// Connected and waiting for a battery level, since then.
    announcing: Option<Instant>,
    /// Headphones and speakers: their battery is shown with the audio output.
    audio: bool,
    kind: BluetoothKind,
}

type Handler = Arc<dyn Fn(SystemPeek) + Send + Sync>;

pub fn start_bluetooth_watch(handler: impl Fn(SystemPeek) + Send + Sync + 'static) {
    let handler: Handler = Arc::new(handler);
    let spawned = std::thread::Builder::new()
        .name("quiera-bluetooth".into())
        .spawn(move || {
            // SAFETY: COM for this thread's WinRT calls.
            let _ = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
            crate::platform::lower_thread_priority();
            watch(&handler);
        });
    if let Err(e) = spawned {
        log::error!("could not start the Bluetooth watch: {e}");
    }
}

fn lookup<T: windows::core::RuntimeType + 'static>(
    device: &DeviceInformation,
    key: &str,
) -> Option<T>
where
    IReference<T>: Interface,
{
    let value = device.Properties().ok()?.Lookup(&HSTRING::from(key)).ok()?;
    value.cast::<IReference<T>>().ok()?.Value().ok()
}

fn find(filter: &str, properties: &[&str]) -> Option<Vec<DeviceInformation>> {
    let properties = IIterable::<HSTRING>::from(
        properties
            .iter()
            .map(|p| HSTRING::from(*p))
            .collect::<Vec<_>>(),
    );
    let found = DeviceInformation::FindAllAsyncWithKindAqsFilterAndAdditionalProperties(
        &HSTRING::from(filter),
        &properties,
        DeviceInformationKind::Device,
    )
    .ok()?
    .join()
    .ok()?;
    Some(found.into_iter().collect())
}

/// The Bluetooth devices that report a battery level, connected or not.
fn read() -> Option<Vec<Reading>> {
    let filter = format!("System.Devices.ClassGuid:=\"{BLUETOOTH_CLASS}\"");
    let devices = find(&filter, &[BATTERY, CONNECTED, CONTAINER])?;
    Some(
        devices
            .iter()
            .filter_map(|d| {
                let container: GUID = lookup(d, CONTAINER)?;
                let battery: Option<u8> = lookup(d, BATTERY);
                let connected = lookup::<bool>(d, CONNECTED).unwrap_or(false);
                // Only the device nodes that carry a battery level count.
                battery.or(connected.then_some(0))?;
                Some(Reading {
                    container,
                    name: d.Name().map(|n| n.to_string()).unwrap_or_default(),
                    connected,
                    battery,
                })
            })
            .collect(),
    )
}

/// What a device is, from the classes of the devices it is made of
/// (a keyboard's container holds a Keyboard device…).
fn kind_of(container: GUID) -> (bool, BluetoothKind) {
    let filter = format!("System.Devices.ContainerId:=\"{{{container:?}}}\"");
    let classes: Vec<String> = find(&filter, &[CLASS])
        .unwrap_or_default()
        .iter()
        .filter_map(|d| lookup::<GUID>(d, CLASS))
        .map(|g| format!("{g:?}").to_ascii_lowercase())
        .collect();
    let has = |class: &str| classes.iter().any(|c| c == class);
    let audio = has(MEDIA_CLASS) || has(AUDIO_ENDPOINT_CLASS);
    let kind = if has(XBOX_CLASS) {
        BluetoothKind::Gamepad
    } else if has(KEYBOARD_CLASS) {
        BluetoothKind::Keyboard
    } else if has(MOUSE_CLASS) {
        BluetoothKind::Mouse
    } else {
        BluetoothKind::Other
    };
    (audio, kind)
}

fn watch(handler: &Handler) {
    let mut known: HashMap<GUID, Known> = HashMap::new();
    let mut first = true;
    loop {
        if let Some(readings) = read() {
            // Several device nodes can share a container: one entry each.
            let mut by_container: HashMap<GUID, Reading> = HashMap::new();
            for r in readings {
                let entry = by_container.entry(r.container).or_insert(Reading {
                    container: r.container,
                    name: r.name.clone(),
                    connected: false,
                    battery: None,
                });
                entry.connected |= r.connected;
                entry.battery = entry.battery.or(r.battery);
                if entry.name.is_empty() {
                    entry.name = r.name;
                }
            }
            for (container, now) in by_container {
                let device = known.entry(container).or_insert_with(|| {
                    let (audio, kind) = kind_of(container);
                    Known {
                        // At start, what is already connected is not news.
                        connected: first && now.connected,
                        battery: now.battery,
                        announcing: None,
                        audio,
                        kind,
                    }
                });
                if now.connected && !device.connected {
                    device.announcing = Some(Instant::now());
                }
                if !now.connected {
                    device.announcing = None;
                }
                // Announced once its level is known, if it comes soon enough.
                if let (Some(since), Some(level)) = (device.announcing, now.battery) {
                    device.announcing = None;
                    if !device.audio && since.elapsed() < BATTERY_WAIT {
                        handler(SystemPeek::Bluetooth {
                            name: now.name.clone(),
                            device: device.kind,
                            battery: level,
                            low: battery_low(level),
                        });
                    }
                } else if now.connected
                    && device.announcing.is_none()
                    && let (Some(before), Some(level)) = (device.battery, now.battery)
                    && !battery_low(before)
                    && battery_low(level)
                {
                    handler(SystemPeek::Bluetooth {
                        name: now.name.clone(),
                        device: device.kind,
                        battery: level,
                        low: true,
                    });
                }
                device.connected = now.connected;
                if now.battery.is_some() {
                    device.battery = now.battery;
                }
            }
            first = false;
        }
        std::thread::sleep(EVERY);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Reads this computer's Bluetooth devices (names not printed).
    #[test]
    #[ignore = "reads this computer's devices"]
    fn reads_this_computers_devices() {
        // SAFETY: COM for this test thread.
        let _ = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
        let readings = read().expect("devices read");
        for r in readings.iter().filter(|r| r.battery.is_some()) {
            let (audio, kind) = kind_of(r.container);
            eprintln!(
                "connected={} battery={:?} audio={audio} kind={kind:?}",
                r.connected, r.battery
            );
        }
        assert!(readings.iter().any(|r| r.battery.is_some()));
    }
}
