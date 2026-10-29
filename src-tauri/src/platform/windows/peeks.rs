//! What the system peeks watch on Windows:
//!
//! - power: `WM_POWERBROADCAST` on a hidden top-level window;
//! - Caps Lock: its toggle state, read every 150 ms on that window's thread
//!   (one cheap call; Windows sends no event for it without a keyboard hook,
//!   which Quiera does not install);
//! - default audio output and volume: Core Audio callbacks, handled on an
//!   audio thread. A Bluetooth device's battery comes from the device
//!   properties Windows keeps for it.

use std::cell::RefCell;
use std::sync::Arc;
use std::sync::mpsc::{self, Sender};

use windows::Devices::Enumeration::{DeviceInformation, DeviceInformationKind};
use windows::Foundation::IReference;
use windows::Win32::Devices::FunctionDiscovery::{
    PKEY_Device_ContainerId, PKEY_Device_DeviceDesc, PKEY_Device_FriendlyName,
    PKEY_DeviceInterface_FriendlyName,
};
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, PROPERTYKEY, WPARAM};
use windows::Win32::Media::Audio::Endpoints::{
    IAudioEndpointVolume, IAudioEndpointVolumeCallback, IAudioEndpointVolumeCallback_Impl,
};
use windows::Win32::Media::Audio::{
    AUDIO_VOLUME_NOTIFICATION_DATA, DEVICE_STATE, EDataFlow, ERole, IMMDevice, IMMDeviceEnumerator,
    IMMNotificationClient, IMMNotificationClient_Impl, MMDeviceEnumerator,
    PKEY_AudioEndpoint_FormFactor, eConsole, eRender,
};
use windows::Win32::System::Com::StructuredStorage::{
    PropVariantToGUID, PropVariantToStringAlloc, PropVariantToUInt32,
};
use windows::Win32::System::Com::{
    CLSCTX_ALL, COINIT_MULTITHREADED, CoCreateInstance, CoInitializeEx, CoTaskMemFree, STGM_READ,
};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
use windows::Win32::UI::Input::KeyboardAndMouse::{GetKeyState, VK_CAPITAL};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DispatchMessageW, GetMessageW, MSG, PBT_APMPOWERSTATUSCHANGE,
    RegisterClassW, SetTimer, TranslateMessage, WM_POWERBROADCAST, WM_TIMER, WNDCLASSW,
    WS_EX_TOOLWINDOW, WS_POPUP,
};
use windows::core::{GUID, HSTRING, Interface, PCWSTR, implement, w};
use windows_collections::IIterable;

use crate::peeks::{DeviceForm, PowerReading, SystemPeek, power_peek, volume_percent};

type Handler = Arc<dyn Fn(SystemPeek) + Send + Sync>;

pub fn start_peek_watch(handler: impl Fn(SystemPeek) + Send + Sync + 'static) {
    let handler: Handler = Arc::new(handler);
    let for_window = handler.clone();
    spawn("quiera-peeks", move || {
        // SAFETY: window and timer on this thread, which runs their loop.
        unsafe { run_window(for_window) }
    });
    spawn("quiera-audio-peeks", move || run_audio(handler));
}

fn spawn(name: &str, f: impl FnOnce() -> windows::core::Result<()> + Send + 'static) {
    let label = name.to_owned();
    let spawned = std::thread::Builder::new()
        .name(name.into())
        .spawn(move || {
            if let Err(e) = f() {
                log::error!("{label} stopped: {e}");
            }
        });
    if let Err(e) = spawned {
        log::error!("could not start {name}: {e}");
    }
}

// ---- Power and Caps Lock -------------------------------------------------

const CAPS_TIMER: usize = 1;
const CAPS_POLL_MS: u32 = 150;

struct WindowState {
    handler: Handler,
    power: Option<PowerReading>,
    caps: bool,
}

thread_local! {
    static STATE: RefCell<Option<WindowState>> = const { RefCell::new(None) };
}

fn read_power() -> Option<PowerReading> {
    let mut status = SYSTEM_POWER_STATUS::default();
    // SAFETY: fills the struct.
    unsafe { GetSystemPowerStatus(&mut status) }.ok()?;
    // 128: no system battery; 255: unknown.
    let has_battery = status.BatteryFlag != 128 && status.BatteryFlag != 255;
    Some(PowerReading {
        has_battery,
        plugged: status.ACLineStatus == 1,
        percent: (status.BatteryLifePercent <= 100).then_some(status.BatteryLifePercent),
    })
}

fn caps_on() -> bool {
    // SAFETY: a read-only query; the low bit is the toggle state.
    unsafe { GetKeyState(i32::from(VK_CAPITAL.0)) & 1 != 0 }
}

unsafe fn run_window(handler: Handler) -> windows::core::Result<()> {
    unsafe {
        let instance = GetModuleHandleW(None)?;
        let class = w!("QuieraPeeks");
        RegisterClassW(&WNDCLASSW {
            lpfnWndProc: Some(window_proc),
            hInstance: instance.into(),
            lpszClassName: class,
            ..Default::default()
        });
        // Top-level (not message-only): power broadcasts skip message-only windows.
        let hwnd = CreateWindowExW(
            WS_EX_TOOLWINDOW,
            class,
            w!("Quiera peeks"),
            WS_POPUP,
            0,
            0,
            0,
            0,
            None,
            None,
            Some(instance.into()),
            None,
        )?;
        STATE.with_borrow_mut(|s| {
            *s = Some(WindowState {
                handler,
                power: read_power(),
                caps: caps_on(),
            })
        });
        SetTimer(Some(hwnd), CAPS_TIMER, CAPS_POLL_MS, None);
        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).as_bool() {
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
        Ok(())
    }
}

fn emit_from_window(peek: SystemPeek) {
    STATE.with_borrow(|s| {
        if let Some(s) = s {
            (s.handler)(peek)
        }
    });
}

unsafe extern "system" fn window_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    match msg {
        WM_POWERBROADCAST if wparam.0 as u32 == PBT_APMPOWERSTATUSCHANGE => {
            if let Some(now) = read_power() {
                let peek = STATE.with_borrow_mut(|s| {
                    let s = s.as_mut()?;
                    let peek = power_peek(s.power, now);
                    s.power = Some(now);
                    peek
                });
                if let Some(peek) = peek {
                    emit_from_window(peek);
                }
            }
        }
        WM_TIMER if wparam.0 == CAPS_TIMER => {
            let on = caps_on();
            let changed = STATE.with_borrow_mut(|s| match s {
                Some(s) if s.caps != on => {
                    s.caps = on;
                    true
                }
                _ => false,
            });
            if changed {
                emit_from_window(SystemPeek::CapsLock { on });
            }
        }
        _ => {}
    }
    // SAFETY: default handling for every message.
    unsafe { DefWindowProcW(hwnd, msg, wparam, lparam) }
}

// ---- Audio output and volume --------------------------------------------

enum AudioMsg {
    DefaultChanged,
    Volume { scalar: f32, muted: bool },
}

#[implement(IMMNotificationClient)]
struct DeviceWatcher {
    tx: Sender<AudioMsg>,
}

impl IMMNotificationClient_Impl for DeviceWatcher_Impl {
    fn OnDeviceStateChanged(
        &self,
        _id: &PCWSTR,
        _state: DEVICE_STATE,
    ) -> windows::core::Result<()> {
        Ok(())
    }

    fn OnDeviceAdded(&self, _id: &PCWSTR) -> windows::core::Result<()> {
        Ok(())
    }

    fn OnDeviceRemoved(&self, _id: &PCWSTR) -> windows::core::Result<()> {
        Ok(())
    }

    fn OnDefaultDeviceChanged(
        &self,
        flow: EDataFlow,
        role: ERole,
        _id: &PCWSTR,
    ) -> windows::core::Result<()> {
        // Windows reports each role; the console role is the one people hear.
        if flow == eRender && role == eConsole {
            let _ = self.tx.send(AudioMsg::DefaultChanged);
        }
        Ok(())
    }

    fn OnPropertyValueChanged(
        &self,
        _id: &PCWSTR,
        _key: &PROPERTYKEY,
    ) -> windows::core::Result<()> {
        Ok(())
    }
}

#[implement(IAudioEndpointVolumeCallback)]
struct VolumeWatcher {
    tx: Sender<AudioMsg>,
}

impl IAudioEndpointVolumeCallback_Impl for VolumeWatcher_Impl {
    fn OnNotify(&self, data: *mut AUDIO_VOLUME_NOTIFICATION_DATA) -> windows::core::Result<()> {
        // SAFETY: Windows passes valid data for the duration of the call.
        if let Some(d) = unsafe { data.as_ref() } {
            let _ = self.tx.send(AudioMsg::Volume {
                scalar: d.fMasterVolume,
                muted: d.bMuted.as_bool(),
            });
        }
        Ok(())
    }
}

/// The default output's id, volume control and current level.
struct Output {
    id: String,
    device: IMMDevice,
    volume: Option<IAudioEndpointVolume>,
}

fn default_output(enumerator: &IMMDeviceEnumerator) -> Option<Output> {
    // SAFETY: COM calls on this thread's apartment; the id string is freed.
    unsafe {
        let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole).ok()?;
        let raw = device.GetId().ok()?;
        let id = raw.to_string().unwrap_or_default();
        CoTaskMemFree(Some(raw.0 as *const _));
        let volume = device
            .Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None)
            .ok();
        Some(Output { id, device, volume })
    }
}

fn level_of(volume: &IAudioEndpointVolume) -> Option<(u8, bool)> {
    // SAFETY: plain COM getters.
    unsafe {
        Some((
            volume_percent(volume.GetMasterVolumeLevelScalar().ok()?),
            volume.GetMute().ok()?.as_bool(),
        ))
    }
}

fn run_audio(handler: Handler) -> windows::core::Result<()> {
    // SAFETY: COM for this thread; callbacks only post to the channel.
    unsafe {
        CoInitializeEx(None, COINIT_MULTITHREADED).ok()?;
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let (tx, rx) = mpsc::channel();
        let devices: IMMNotificationClient = DeviceWatcher { tx: tx.clone() }.into();
        enumerator.RegisterEndpointNotificationCallback(&devices)?;
        let volumes: IAudioEndpointVolumeCallback = VolumeWatcher { tx }.into();

        let mut output = default_output(&enumerator);
        let mut last = output
            .as_ref()
            .and_then(|o| o.volume.as_ref())
            .and_then(level_of);
        if let Some(v) = output.as_ref().and_then(|o| o.volume.as_ref()) {
            let _ = v.RegisterControlChangeNotify(&volumes);
        }
        log::info!("audio peek watcher started");

        for msg in rx {
            match msg {
                AudioMsg::DefaultChanged => {
                    let next = default_output(&enumerator);
                    if next.as_ref().map(|o| &o.id) == output.as_ref().map(|o| &o.id) {
                        continue;
                    }
                    if let Some(v) = output.as_ref().and_then(|o| o.volume.as_ref()) {
                        let _ = v.UnregisterControlChangeNotify(&volumes);
                    }
                    if let Some(v) = next.as_ref().and_then(|o| o.volume.as_ref()) {
                        let _ = v.RegisterControlChangeNotify(&volumes);
                    }
                    last = next
                        .as_ref()
                        .and_then(|o| o.volume.as_ref())
                        .and_then(level_of);
                    if let Some(o) = &next {
                        handler(describe(&o.device));
                    }
                    output = next;
                }
                AudioMsg::Volume { scalar, muted } => {
                    let now = (volume_percent(scalar), muted);
                    if last != Some(now) {
                        last = Some(now);
                        handler(SystemPeek::Volume {
                            level: now.0,
                            muted: now.1,
                        });
                    }
                }
            }
        }
        // Keeps the registration alive for as long as the loop runs.
        drop(devices);
        Ok(())
    }
}

/** An audio endpoint's names and form, as Windows lists them. */
pub(super) struct EndpointLabel {
    /// The device's own name ("WH-1000XM4", "Realtek(R) Audio").
    pub short: String,
    /// The endpoint's full name ("Headphones (WH-1000XM4 Stereo)").
    pub full: String,
    /// The endpoint's own description ("Headphones", "Voicemeeter Input").
    pub desc: String,
    pub form: DeviceForm,
}

pub(super) fn label_of(device: &IMMDevice) -> EndpointLabel {
    // SAFETY: property reads on a live device; strings are freed.
    unsafe {
        let store = device.OpenPropertyStore(STGM_READ).ok();
        let string = |key: &PROPERTYKEY| -> Option<String> {
            let value = store.as_ref()?.GetValue(key).ok()?;
            let raw = PropVariantToStringAlloc(&value).ok()?;
            let text = raw.to_string().ok();
            CoTaskMemFree(Some(raw.0 as *const _));
            text.filter(|t| !t.is_empty())
        };
        let full = string(&PKEY_Device_FriendlyName).unwrap_or_else(|| "Sortie audio".into());
        let form = store
            .as_ref()
            .and_then(|s| s.GetValue(&PKEY_AudioEndpoint_FormFactor).ok())
            .and_then(|v| PropVariantToUInt32(&v).ok())
            .map_or(DeviceForm::Other, form_from);
        EndpointLabel {
            short: string(&PKEY_DeviceInterface_FriendlyName).unwrap_or_else(|| full.clone()),
            desc: string(&PKEY_Device_DeviceDesc).unwrap_or_default(),
            full,
            form,
        }
    }
}

fn describe(device: &IMMDevice) -> SystemPeek {
    // The device's own name ("WH-1000XM4") reads better than the
    // endpoint's ("Headphones (WH-1000XM4 Stereo)").
    let EndpointLabel {
        short: name, form, ..
    } = label_of(device);
    // SAFETY: a property read on a live device.
    unsafe {
        let store = device.OpenPropertyStore(STGM_READ).ok();
        let container = store
            .as_ref()
            .and_then(|s| s.GetValue(&PKEY_Device_ContainerId).ok())
            .and_then(|v| PropVariantToGUID(&v).ok());
        SystemPeek::AudioDevice {
            name,
            form,
            battery: container.and_then(battery_of),
        }
    }
}

/// Windows `EndpointFormFactor` values.
fn form_from(value: u32) -> DeviceForm {
    match value {
        1 => DeviceForm::Speakers,
        3 => DeviceForm::Headphones,
        5 => DeviceForm::Headset,
        _ => DeviceForm::Other,
    }
}

/// The battery level Windows reports for a Bluetooth device
/// (`DEVPKEY_Bluetooth_Battery`), looked up among the device nodes that
/// share the audio endpoint's container. None when it reports none.
fn battery_of(container: GUID) -> Option<u8> {
    const BATTERY: &str = "{104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2";
    let filter = HSTRING::from(format!("System.Devices.ContainerId:=\"{{{container:?}}}\""));
    let properties = IIterable::<HSTRING>::from(vec![HSTRING::from(BATTERY)]);
    let devices = DeviceInformation::FindAllAsyncWithKindAqsFilterAndAdditionalProperties(
        &filter,
        &properties,
        DeviceInformationKind::Device,
    )
    .ok()?
    .join()
    .ok()?;
    devices.into_iter().find_map(|device| {
        let value = device
            .Properties()
            .ok()?
            .Lookup(&HSTRING::from(BATTERY))
            .ok()?;
        value.cast::<IReference<u8>>().ok()?.Value().ok()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_endpoint_form_factor() {
        assert_eq!(form_from(3), DeviceForm::Headphones);
        assert_eq!(form_from(5), DeviceForm::Headset);
        assert_eq!(form_from(1), DeviceForm::Speakers);
        assert_eq!(form_from(9), DeviceForm::Other);
    }

    #[test]
    fn formats_the_container_filter_like_windows_expects() {
        let guid = GUID::from_u128(0x0123_4567_89ab_cdef_0123_4567_89ab_cdef);
        assert_eq!(
            format!("{{{guid:?}}}"),
            "{01234567-89AB-CDEF-0123-456789ABCDEF}"
        );
    }
}
