//! The language of the few texts the backend shows itself: the tray menu,
//! the settings window's title and some error messages. The interface's own
//! texts live in `src/i18n`. The phone's page follows the phone's language
//! instead (see `share.rs`).

use crate::platform;
use crate::settings::{self, Language};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Lang {
    Fr,
    En,
}

/// The setting's language, or Windows' display language for "system":
/// French for French, English for everything else (as `src/i18n` does).
pub fn lang() -> Lang {
    match settings::get().general.language {
        Language::Fr => Lang::Fr,
        Language::En => Lang::En,
        Language::System if platform::system_prefers_french() => Lang::Fr,
        Language::System => Lang::En,
    }
}

/// The text in the current language.
pub fn tr(fr: &'static str, en: &'static str) -> &'static str {
    match lang() {
        Lang::Fr => fr,
        Lang::En => en,
    }
}
