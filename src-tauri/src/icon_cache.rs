//! App icons read from the shell, kept by key. A miss is kept for a while
//! too, so an app without an icon is not asked for again at every keystroke,
//! but it is asked again later: the shell may not have had the icon yet (at
//! sign-in, before Explorer is ready), and a miss kept for good left apps
//! with a letter instead of their icon until Quiera restarted.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// How long a miss is believed before the shell is asked again.
pub const RETRY_AFTER: Duration = Duration::from_secs(30);

enum Entry {
    Found(Vec<u8>),
    Missed(Instant),
}

#[derive(Default)]
pub struct IconCache {
    entries: Mutex<HashMap<String, Entry>>,
}

impl IconCache {
    /// The icon for `key`, from the cache or else from `load`.
    pub fn get_or_load(
        &self,
        key: &str,
        load: impl FnOnce() -> Option<Vec<u8>>,
    ) -> Option<Vec<u8>> {
        self.get_or_load_at(key, Instant::now(), load)
    }

    pub fn get_or_load_at(
        &self,
        key: &str,
        now: Instant,
        load: impl FnOnce() -> Option<Vec<u8>>,
    ) -> Option<Vec<u8>> {
        match self.lock().get(key) {
            Some(Entry::Found(png)) => return Some(png.clone()),
            Some(Entry::Missed(at)) if now.duration_since(*at) < RETRY_AFTER => return None,
            _ => {}
        }
        // Not locked while the shell works: other icons are served meanwhile.
        let png = load();
        let entry = png.clone().map_or(Entry::Missed(now), Entry::Found);
        self.lock().insert(key.to_owned(), entry);
        png
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, HashMap<String, Entry>> {
        self.entries.lock().unwrap_or_else(|e| e.into_inner())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;

    #[test]
    fn keeps_icons_and_asks_again_after_a_miss() {
        let cache = IconCache::default();
        let calls = Cell::new(0);
        let t0 = Instant::now();
        let load = |result: Option<Vec<u8>>| {
            calls.set(calls.get() + 1);
            result
        };

        assert_eq!(cache.get_or_load_at("a", t0, || load(None)), None);
        // A miss is believed for a while: no new shell call.
        assert_eq!(
            cache.get_or_load_at("a", t0 + Duration::from_secs(5), || load(Some(vec![1]))),
            None
        );
        assert_eq!(calls.get(), 1);
        // Then asked again, and a found icon is kept.
        assert_eq!(
            cache.get_or_load_at("a", t0 + RETRY_AFTER, || load(Some(vec![1]))),
            Some(vec![1])
        );
        assert_eq!(
            cache.get_or_load_at("a", t0 + RETRY_AFTER * 9, || load(None)),
            Some(vec![1])
        );
        assert_eq!(calls.get(), 2);
    }
}
