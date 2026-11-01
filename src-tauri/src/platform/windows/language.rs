//! Windows' display language, for the "system" language setting.

use windows::Win32::Globalization::GetUserDefaultUILanguage;

/// LANG_FRENCH, the primary language of every French locale.
const LANG_FRENCH: u16 = 0x0c;

/// Whether Windows shows itself in French (France, Belgium, Canada...).
pub fn system_prefers_french() -> bool {
    // SAFETY: a plain query with no arguments.
    let id = unsafe { GetUserDefaultUILanguage() };
    id & 0x3ff == LANG_FRENCH
}
