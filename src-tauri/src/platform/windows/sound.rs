//! Windows' own notification sounds: they follow the user's sound scheme
//! and volume, and need no file shipped with Quiera.

use windows::Win32::Media::Audio::{PlaySoundW, SND_ALIAS, SND_ASYNC, SND_NODEFAULT};
use windows::core::HSTRING;

/// Plays a sound of the Windows scheme ("Notification.Default"…), without
/// waiting for it; nothing when the scheme has none.
pub fn play_system_sound(alias: &str) {
    let alias = HSTRING::from(alias);
    // SAFETY: plays an alias of the sound scheme, asynchronously.
    unsafe {
        let _ = PlaySoundW(&alias, None, SND_ALIAS | SND_ASYNC | SND_NODEFAULT);
    }
}
