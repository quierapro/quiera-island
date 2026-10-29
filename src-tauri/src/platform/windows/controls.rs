//! Quick controls on Windows: Wi-Fi and Bluetooth radios, the audio output,
//! the master volume and each app's volume.
//!
//! Switching the default output has no public API: `IPolicyConfig`, the
//! interface the Sound settings use, has been stable since Windows 7 and is
//! what SoundSwitch and EarTrumpet rely on too.

use std::collections::HashMap;
use std::ffi::c_void;
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex};

use windows::Devices::Radios::{Radio, RadioKind as WinRadioKind, RadioState};
use windows::Win32::Foundation::CloseHandle;
use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
use windows::Win32::Media::Audio::{
    AudioSessionStateActive, AudioSessionStateExpired, DEVICE_STATE_ACTIVE, IAudioSessionControl2,
    IAudioSessionManager2, IMMDevice, IMMDeviceEnumerator, ISimpleAudioVolume, MMDeviceEnumerator,
    eCommunications, eConsole, eMultimedia, eRender,
};
use windows::Win32::Storage::FileSystem::{
    GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW,
};
use windows::Win32::System::Com::{
    CLSCTX_ALL, COINIT_MULTITHREADED, CoCreateInstance, CoInitializeEx, CoTaskMemFree,
};
use windows::Win32::System::Threading::{
    OpenProcess, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION, QueryFullProcessImageNameW,
};
use windows::core::{GUID, HRESULT, HSTRING, Interface, PCWSTR, PWSTR, w};

use super::peeks::label_of;
use crate::controls::{RadioKind, RawApp, RawControls, RawOutput};
use crate::peeks::volume_percent;

mod policy {
    //! The policy interface, with its COM method names as Windows declares them.
    #![allow(non_snake_case)]

    use std::ffi::c_void;

    use windows::Win32::Foundation::PROPERTYKEY;
    use windows::Win32::Media::Audio::ERole;
    use windows::core::{HRESULT, PCWSTR};

    #[windows::core::interface("f8679f50-850a-41cf-9c72-430f290290c8")]
    pub unsafe trait IPolicyConfig: windows::core::IUnknown {
        // Only SetDefaultEndpoint is used; the others keep the vtable in order.
        fn GetMixFormat(&self, device: PCWSTR, format: *mut *mut c_void) -> HRESULT;
        fn GetDeviceFormat(
            &self,
            device: PCWSTR,
            default: i32,
            format: *mut *mut c_void,
        ) -> HRESULT;
        fn ResetDeviceFormat(&self, device: PCWSTR) -> HRESULT;
        fn SetDeviceFormat(
            &self,
            device: PCWSTR,
            endpoint: *mut c_void,
            mix: *mut c_void,
        ) -> HRESULT;
        fn GetProcessingPeriod(
            &self,
            device: PCWSTR,
            default: i32,
            default_period: *mut i64,
            min_period: *mut i64,
        ) -> HRESULT;
        fn SetProcessingPeriod(&self, device: PCWSTR, period: *mut i64) -> HRESULT;
        fn GetShareMode(&self, device: PCWSTR, mode: *mut c_void) -> HRESULT;
        fn SetShareMode(&self, device: PCWSTR, mode: *mut c_void) -> HRESULT;
        fn GetPropertyValue(
            &self,
            device: PCWSTR,
            fx_store: i32,
            key: *const PROPERTYKEY,
            value: *mut c_void,
        ) -> HRESULT;
        fn SetPropertyValue(
            &self,
            device: PCWSTR,
            fx_store: i32,
            key: *const PROPERTYKEY,
            value: *mut c_void,
        ) -> HRESULT;
        pub fn SetDefaultEndpoint(&self, device: PCWSTR, role: ERole) -> HRESULT;
        fn SetEndpointVisibility(&self, device: PCWSTR, visible: i32) -> HRESULT;
    }
}

use policy::IPolicyConfig;

const CLSID_POLICY_CONFIG: GUID = GUID::from_u128(0x870af99c_171d_4f9e_af0d_e63df40c2bc9);

fn com() {
    // SAFETY: COM for the calling thread; a no-op when already initialised.
    let _ = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
}

fn enumerator() -> windows::core::Result<IMMDeviceEnumerator> {
    // SAFETY: creates the system's device enumerator.
    unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) }
}

fn device_id(device: &IMMDevice) -> Option<String> {
    // SAFETY: the id string is copied, then freed.
    unsafe {
        let raw = device.GetId().ok()?;
        let id = raw.to_string().ok();
        CoTaskMemFree(Some(raw.0 as *const _));
        id
    }
}

fn default_render() -> Option<IMMDevice> {
    // SAFETY: a plain COM getter.
    unsafe {
        enumerator()
            .ok()?
            .GetDefaultAudioEndpoint(eRender, eConsole)
            .ok()
    }
}

/// Everything the controls tab shows, read now.
pub fn read_controls() -> RawControls {
    com();
    RawControls {
        radios: read_radios(),
        outputs: read_outputs(),
        master: read_master(),
        apps: read_apps(),
    }
}

// ---- Radios -------------------------------------------------------------

fn radio_kind(kind: WinRadioKind) -> Option<RadioKind> {
    match kind {
        WinRadioKind::WiFi => Some(RadioKind::Wifi),
        WinRadioKind::Bluetooth => Some(RadioKind::Bluetooth),
        _ => None,
    }
}

fn radios() -> Vec<Radio> {
    Radio::GetRadiosAsync()
        .and_then(|op| op.join())
        .map(|list| list.into_iter().collect())
        .unwrap_or_default()
}

fn read_radios() -> Vec<(RadioKind, bool)> {
    let mut found: Vec<(RadioKind, bool)> = Vec::new();
    for radio in radios() {
        let Some(kind) = radio.Kind().ok().and_then(radio_kind) else {
            continue;
        };
        if found.iter().any(|(k, _)| *k == kind) {
            continue;
        }
        found.push((kind, radio.State().is_ok_and(|s| s == RadioState::On)));
    }
    found
}

pub fn set_radio(kind: RadioKind, on: bool) -> Result<(), String> {
    com();
    let _ = Radio::RequestAccessAsync().and_then(|op| op.join());
    let state = if on { RadioState::On } else { RadioState::Off };
    let mut done = false;
    for radio in radios() {
        if radio.Kind().ok().and_then(radio_kind) == Some(kind) {
            radio
                .SetStateAsync(state)
                .and_then(|op| op.join())
                .map_err(|e| e.to_string())?;
            done = true;
        }
    }
    if done {
        Ok(())
    } else {
        Err("no such radio".into())
    }
}

// ---- Outputs ------------------------------------------------------------

fn read_outputs() -> Vec<RawOutput> {
    let Ok(enumerator) = enumerator() else {
        return Vec::new();
    };
    let default = default_render().as_ref().and_then(device_id);
    // SAFETY: plain COM enumeration.
    let Ok(list) = (unsafe { enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE) }) else {
        return Vec::new();
    };
    let count = unsafe { list.GetCount() }.unwrap_or(0);
    (0..count)
        .filter_map(|i| {
            // SAFETY: an index within the collection.
            let device = unsafe { list.Item(i) }.ok()?;
            let id = device_id(&device)?;
            let label = label_of(&device);
            Some(RawOutput {
                default: default.as_deref() == Some(id.as_str()),
                id,
                short: label.short,
                full: label.full,
                desc: label.desc,
                form: label.form,
            })
        })
        .collect()
}

pub fn set_default_output(id: &str) -> Result<(), String> {
    com();
    // SAFETY: the undocumented but stable policy interface; the id outlives
    // the calls.
    unsafe {
        let policy: IPolicyConfig =
            CoCreateInstance(&CLSID_POLICY_CONFIG, None, CLSCTX_ALL).map_err(|e| e.to_string())?;
        let id = HSTRING::from(id);
        for role in [eConsole, eMultimedia, eCommunications] {
            policy
                .SetDefaultEndpoint(PCWSTR(id.as_ptr()), role)
                .ok()
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

// ---- Master volume ------------------------------------------------------

fn master_volume() -> Option<IAudioEndpointVolume> {
    // SAFETY: activates the volume interface of the default output.
    unsafe { default_render()?.Activate(CLSCTX_ALL, None).ok() }
}

fn read_master() -> Option<(u8, bool)> {
    let volume = master_volume()?;
    // SAFETY: plain COM getters.
    unsafe {
        Some((
            volume_percent(volume.GetMasterVolumeLevelScalar().ok()?),
            volume.GetMute().ok()?.as_bool(),
        ))
    }
}

pub fn set_master_volume(level: u8) -> Result<(), String> {
    com();
    let volume = master_volume().ok_or("no output")?;
    // SAFETY: a plain COM setter.
    unsafe {
        volume.SetMasterVolumeLevelScalar(f32::from(level.min(100)) / 100.0, std::ptr::null())
    }
    .map_err(|e| e.to_string())
}

pub fn set_master_mute(muted: bool) -> Result<(), String> {
    com();
    let volume = master_volume().ok_or("no output")?;
    // SAFETY: a plain COM setter.
    unsafe { volume.SetMute(muted, std::ptr::null()) }.map_err(|e| e.to_string())
}

// ---- Apps ---------------------------------------------------------------

/// The live audio sessions of the default output, with their app's path.
fn sessions() -> Vec<(PathBuf, bool, ISimpleAudioVolume)> {
    let own = std::process::id();
    let Some(manager) = default_render()
        .and_then(|d| unsafe { d.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None) }.ok())
    else {
        return Vec::new();
    };
    // SAFETY: plain COM enumeration and getters.
    unsafe {
        let Ok(list) = manager.GetSessionEnumerator() else {
            return Vec::new();
        };
        let count = list.GetCount().unwrap_or(0);
        (0..count)
            .filter_map(|i| {
                let control = list.GetSession(i).ok()?;
                let state = control.GetState().ok()?;
                if state == AudioSessionStateExpired {
                    return None;
                }
                let control2: IAudioSessionControl2 = control.cast().ok()?;
                // S_OK means system sounds: not an app.
                if control2.IsSystemSoundsSession() == HRESULT(0) {
                    return None;
                }
                let pid = control2.GetProcessId().ok()?;
                if pid == 0 || pid == own {
                    return None;
                }
                let path = process_path(pid)?;
                Some((path, state == AudioSessionStateActive, control.cast().ok()?))
            })
            .collect()
    }
}

fn process_path(pid: u32) -> Option<PathBuf> {
    // SAFETY: a limited query handle, closed below; the buffer is sized.
    unsafe {
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buffer = vec![0u16; 1024];
        let mut len = buffer.len() as u32;
        let ok = QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_WIN32,
            PWSTR(buffer.as_mut_ptr()),
            &mut len,
        );
        let _ = CloseHandle(process);
        ok.ok()?;
        Some(PathBuf::from(String::from_utf16_lossy(
            &buffer[..len as usize],
        )))
    }
}

/// Names already read, by path: the version block is read once per app.
static NAMES: LazyLock<Mutex<HashMap<PathBuf, String>>> = LazyLock::new(Mutex::default);

/// The name an app gives itself ("Microsoft Edge"), else its file name.
fn app_name(path: &Path) -> String {
    let mut names = NAMES.lock().unwrap_or_else(|e| e.into_inner());
    names
        .entry(path.to_path_buf())
        .or_insert_with(|| {
            file_description(path).unwrap_or_else(|| {
                path.file_stem()
                    .map(|s| s.to_string_lossy().into_owned())
                    .unwrap_or_default()
            })
        })
        .clone()
}

fn file_description(path: &Path) -> Option<String> {
    let file = HSTRING::from(path.as_os_str());
    // SAFETY: the version block is sized by Windows, and the pointers
    // VerQueryValueW returns point into it while it lives.
    unsafe {
        let size = GetFileVersionInfoSizeW(&file, None);
        if size == 0 {
            return None;
        }
        let mut block = vec![0u8; size as usize];
        GetFileVersionInfoW(&file, None, size, block.as_mut_ptr().cast()).ok()?;
        let mut ptr: *mut c_void = std::ptr::null_mut();
        let mut len = 0u32;
        if !VerQueryValueW(
            block.as_ptr().cast(),
            w!("\\VarFileInfo\\Translation"),
            &mut ptr,
            &mut len,
        )
        .as_bool()
            || len < 4
        {
            return None;
        }
        let lang = *(ptr as *const u16);
        let codepage = *(ptr as *const u16).add(1);
        let query = HSTRING::from(format!(
            "\\StringFileInfo\\{lang:04x}{codepage:04x}\\FileDescription"
        ));
        if !VerQueryValueW(block.as_ptr().cast(), &query, &mut ptr, &mut len).as_bool() || len == 0
        {
            return None;
        }
        let text = std::slice::from_raw_parts(ptr as *const u16, len as usize);
        // The length may run past the string: it ends at the first nul.
        let text = String::from_utf16_lossy(text);
        let text = text
            .split('\0')
            .next()
            .unwrap_or_default()
            .trim()
            .to_owned();
        (!text.is_empty()).then_some(text)
    }
}

fn read_apps() -> Vec<RawApp> {
    // (app, playing now)
    let mut apps: Vec<(RawApp, bool)> = Vec::new();
    for (path, active, volume) in sessions() {
        // SAFETY: plain COM getters.
        let (level, muted) = unsafe {
            (
                volume.GetMasterVolume().map(volume_percent).unwrap_or(100),
                volume.GetMute().map(|m| m.as_bool()).unwrap_or(false),
            )
        };
        // One app may play from several processes (a browser): one line.
        if let Some((_, playing)) = apps.iter_mut().find(|(a, _)| a.path == path) {
            *playing |= active;
            continue;
        }
        let app = RawApp {
            name: app_name(&path),
            path,
            level,
            muted,
        };
        apps.push((app, active));
    }
    // What plays now comes first.
    apps.sort_by_key(|(_, playing)| !playing);
    apps.into_iter().map(|(app, _)| app).collect()
}

/// Applies `f` to every session of the app at `path`.
fn for_app(
    path: &Path,
    f: impl Fn(&ISimpleAudioVolume) -> windows::core::Result<()>,
) -> Result<(), String> {
    com();
    let mut found = false;
    for (p, _, volume) in sessions() {
        if p == path {
            f(&volume).map_err(|e| e.to_string())?;
            found = true;
        }
    }
    if found {
        Ok(())
    } else {
        Err("the app no longer plays".into())
    }
}

pub fn set_app_volume(path: &Path, level: u8) -> Result<(), String> {
    let scalar = f32::from(level.min(100)) / 100.0;
    // SAFETY: a plain COM setter.
    for_app(path, |v| unsafe {
        v.SetMasterVolume(scalar, std::ptr::null())
    })
}

pub fn set_app_mute(path: &Path, muted: bool) -> Result<(), String> {
    // SAFETY: a plain COM setter.
    for_app(path, |v| unsafe { v.SetMute(muted, std::ptr::null()) })
}
