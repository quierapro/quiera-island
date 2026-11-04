//! Shortcuts `RegisterHotKey` cannot hold: a modifier alone (Ctrl, Alt,
//! Shift, Win) and a key pressed twice. A low-level keyboard hook, installed
//! only while such a shortcut is chosen, watches that one key: pressed and
//! released with no other key in between (a "tap"), once, or twice in a row.
//!
//! It never keeps which other key was pressed (only that one was, so Ctrl+C
//! is not a tap of Ctrl), and lets every key through untouched.

use std::sync::Mutex;
use std::sync::atomic::{AtomicIsize, Ordering};
use std::time::{Duration, Instant};

use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, HHOOK, KBDLLHOOKSTRUCT, LLKHF_INJECTED, SetWindowsHookExW, UnhookWindowsHookEx,
    WH_KEYBOARD_LL, WM_KEYDOWN, WM_SYSKEYDOWN,
};

use crate::settings::Hotkey;

/// A press longer than this is holding the key, not tapping it.
const TAP_MAX: Duration = Duration::from_millis(600);
/// The second tap of a double must come this soon after the first.
const DOUBLE_GAP: Duration = Duration::from_millis(450);

const SHIFT: u32 = 0x10;
const CONTROL: u32 = 0x11;
const ALT: u32 = 0x12;
const WIN: u32 = 0x5B;

/// Left and right modifiers are one key here.
fn normalize(vk: u32) -> u32 {
    match vk {
        0xA0 | 0xA1 => SHIFT,
        0xA2 | 0xA3 => CONTROL,
        0xA4 | 0xA5 => ALT,
        0x5C => WIN,
        other => other,
    }
}

pub fn is_modifier(vk: u32) -> bool {
    matches!(normalize(vk), SHIFT | CONTROL | ALT | WIN)
}

/// Whether a shortcut needs the hook: a modifier alone, or a double press.
pub fn wants_hook(hotkey: &Hotkey) -> bool {
    !hotkey.is_none() && (hotkey.double || is_modifier(hotkey.key))
}

/// Taps of one key, once or twice in a row.
#[derive(Debug)]
pub struct Detector {
    key: u32,
    double: bool,
    down_at: Option<Instant>,
    /// Another key went down while this one was held.
    dirty: bool,
    first_tap: Option<Instant>,
}

impl Detector {
    pub fn new(key: u32, double: bool) -> Self {
        Detector {
            key: normalize(key),
            double,
            down_at: None,
            dirty: false,
            first_tap: None,
        }
    }

    /// A key went down or up: true when the shortcut is complete.
    pub fn step(&mut self, vk: u32, down: bool, now: Instant) -> bool {
        if normalize(vk) != self.key {
            if down {
                // Ctrl+C is not a tap of Ctrl, and breaks a double.
                self.dirty |= self.down_at.is_some();
                self.first_tap = None;
            }
            return false;
        }
        if down {
            // Held, the key repeats: only its first press counts.
            if self.down_at.is_none() {
                self.down_at = Some(now);
                self.dirty = false;
            }
            return false;
        }
        let Some(since) = self.down_at.take() else {
            return false;
        };
        if self.dirty || now - since > TAP_MAX {
            self.first_tap = None;
            return false;
        }
        if !self.double {
            return true;
        }
        if self
            .first_tap
            .is_some_and(|first| now - first <= DOUBLE_GAP)
        {
            self.first_tap = None;
            return true;
        }
        self.first_tap = Some(now);
        false
    }
}

static DETECTOR: Mutex<Option<Detector>> = Mutex::new(None);
static HOOK: AtomicIsize = AtomicIsize::new(0);

unsafe extern "system" fn keyboard(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 {
        // SAFETY: for a low-level keyboard hook, lparam points to a KBDLLHOOKSTRUCT.
        let info = unsafe { &*(lparam.0 as *const KBDLLHOOKSTRUCT) };
        // Keys sent by programs are not the user's.
        if info.flags.0 & LLKHF_INJECTED.0 == 0 {
            let down = matches!(wparam.0 as u32, WM_KEYDOWN | WM_SYSKEYDOWN);
            let fire = DETECTOR
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .as_mut()
                .is_some_and(|d| d.step(info.vkCode, down, Instant::now()));
            if fire {
                super::launcher::fire_island();
            }
        }
    }
    // SAFETY: passes every key on, untouched.
    unsafe { CallNextHookEx(None, code, wparam, lparam) }
}

/// Watches `hotkey`'s key (or nothing). Called on the shortcut thread, whose
/// message loop the hook's calls go through. False when Windows refuses.
pub fn watch(hotkey: Option<&Hotkey>) -> bool {
    *DETECTOR.lock().unwrap_or_else(|e| e.into_inner()) =
        hotkey.map(|h| Detector::new(h.key, h.double));
    let installed = HOOK.load(Ordering::Relaxed);
    match (hotkey.is_some(), installed != 0) {
        (true, false) => {
            // SAFETY: a hook procedure of this module, removed below.
            let hook = unsafe {
                let module = GetModuleHandleW(None).ok();
                SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard), module.map(Into::into), 0)
            };
            match hook {
                Ok(hook) => {
                    HOOK.store(hook.0 as isize, Ordering::Relaxed);
                    true
                }
                Err(e) => {
                    log::warn!("the shortcut's key cannot be watched: {e}");
                    false
                }
            }
        }
        (false, true) => {
            // SAFETY: the hook installed above.
            let _ = unsafe { UnhookWindowsHookEx(HHOOK(installed as *mut _)) };
            HOOK.store(0, Ordering::Relaxed);
            true
        }
        _ => true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ms(n: u64) -> Duration {
        Duration::from_millis(n)
    }

    #[test]
    fn a_tap_of_ctrl_alone() {
        let t = Instant::now();
        let mut ctrl = Detector::new(CONTROL, false);
        assert!(!ctrl.step(0xA2, true, t));
        assert!(!ctrl.step(0xA2, true, t + ms(30)), "auto-repeat");
        assert!(ctrl.step(0xA2, false, t + ms(120)));
    }

    #[test]
    fn ctrl_c_is_not_a_tap_and_neither_is_holding() {
        let t = Instant::now();
        let mut ctrl = Detector::new(CONTROL, false);
        ctrl.step(0xA2, true, t);
        ctrl.step(u32::from(b'C'), true, t + ms(50));
        ctrl.step(u32::from(b'C'), false, t + ms(90));
        assert!(!ctrl.step(0xA2, false, t + ms(120)));
        ctrl.step(0xA3, true, t + ms(500));
        assert!(!ctrl.step(0xA3, false, t + ms(1500)), "held a second");
    }

    #[test]
    fn a_double_tap_needs_two_quick_clean_taps() {
        let t = Instant::now();
        let mut ctrl = Detector::new(CONTROL, true);
        ctrl.step(0xA2, true, t);
        assert!(!ctrl.step(0xA2, false, t + ms(80)));
        ctrl.step(0xA3, true, t + ms(200));
        assert!(ctrl.step(0xA3, false, t + ms(280)));
        // Too slow: two single taps.
        ctrl.step(0xA2, true, t + ms(2000));
        ctrl.step(0xA2, false, t + ms(2080));
        ctrl.step(0xA2, true, t + ms(2900));
        assert!(!ctrl.step(0xA2, false, t + ms(2980)));
    }

    #[test]
    fn copy_then_paste_quickly_never_fires() {
        let t = Instant::now();
        let mut ctrl = Detector::new(CONTROL, true);
        for (i, letter) in b"CV".iter().copied().enumerate() {
            let at = t + ms(250 * i as u64);
            ctrl.step(0xA2, true, at);
            ctrl.step(u32::from(letter), true, at + ms(40));
            ctrl.step(u32::from(letter), false, at + ms(70));
            assert!(!ctrl.step(0xA2, false, at + ms(100)));
        }
    }

    #[test]
    fn a_key_typed_between_breaks_a_double() {
        let t = Instant::now();
        let mut f9 = Detector::new(0x78, true);
        f9.step(0x78, true, t);
        f9.step(0x78, false, t + ms(60));
        f9.step(u32::from(b'A'), true, t + ms(100));
        f9.step(0x78, true, t + ms(150));
        assert!(!f9.step(0x78, false, t + ms(210)));
    }

    #[test]
    fn knows_which_shortcuts_need_watching() {
        let ctrl = Hotkey {
            key: CONTROL,
            label: "Ctrl".into(),
            ..Hotkey::none()
        };
        assert!(wants_hook(&ctrl));
        assert!(
            !wants_hook(&Hotkey::default()),
            "Ctrl+Alt+I: Windows holds it"
        );
        let f9_twice = Hotkey {
            key: 0x78,
            double: true,
            ..Hotkey::none()
        };
        assert!(wants_hook(&f9_twice));
        assert!(!wants_hook(&Hotkey::none()));
    }
}
