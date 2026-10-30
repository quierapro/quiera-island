//! Notifications: each new one is announced on the island, and the recent
//! ones are kept in the Notifications tab for the session. The list follows
//! the notification centre: what is dismissed there leaves here too.
//!
//! Content stays in memory and out of the log.

use std::collections::hash_map::DefaultHasher;
use std::collections::{HashMap, HashSet};
use std::hash::{Hash, Hasher};
use std::sync::{LazyLock, Mutex};

use serde::Serialize;
use tauri::http::{Response, StatusCode, header};
use tauri::{AppHandle, Emitter};
use tauri_plugin_opener::OpenerExt;

use crate::media::Artwork;
use crate::peeks::{self, SystemPeek};
use crate::{platform, protocol};

pub const CHANGED_EVENT: &str = "notifications://changed";
pub const ICON_SCHEME: &str = "quiera-notif";
const MAX_ITEMS: usize = 50;

/// A notification as the platform reads it.
pub struct RawNotification {
    pub id: u32,
    pub app_id: String,
    pub app_name: String,
    pub title: String,
    pub body: String,
    pub arrived_ms: u64,
    pub icon: Option<Artwork>,
}

pub enum NotificationEvent {
    Added(RawNotification),
    /// Gone from the notification centre (dismissed, opened, expired).
    Removed(u32),
}

/// Mirrors `NotificationItem` in `src/ipc/notifications.ts`.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationItem {
    pub id: u32,
    pub app: String,
    pub title: String,
    pub body: String,
    pub arrived_at: u64,
    /// The app's icon URL.
    pub icon: Option<String>,
}

struct Entry {
    item: NotificationItem,
    app_id: String,
}

#[derive(Default)]
struct Store {
    entries: Vec<Entry>,
    /// App icons, by a short key derived from the app id.
    icons: HashMap<String, Artwork>,
}

static STORE: LazyLock<Mutex<Store>> = LazyLock::new(Mutex::default);

fn store() -> std::sync::MutexGuard<'static, Store> {
    STORE.lock().unwrap_or_else(|e| e.into_inner())
}

/// Which ids appeared and which left, between two looks at the centre.
pub fn diff(known: &HashSet<u32>, now: &[u32]) -> (Vec<u32>, Vec<u32>) {
    let current: HashSet<u32> = now.iter().copied().collect();
    let added = now
        .iter()
        .copied()
        .filter(|id| !known.contains(id))
        .collect();
    let mut removed: Vec<u32> = known.difference(&current).copied().collect();
    removed.sort_unstable();
    (added, removed)
}

fn icon_key(app_id: &str) -> String {
    let mut hasher = DefaultHasher::new();
    app_id.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

impl Store {
    fn add(&mut self, raw: RawNotification) -> NotificationItem {
        let key = icon_key(&raw.app_id);
        if let Some(icon) = raw.icon {
            self.icons.insert(key.clone(), icon);
        }
        let item = NotificationItem {
            id: raw.id,
            app: raw.app_name,
            title: raw.title,
            body: raw.body,
            arrived_at: raw.arrived_ms,
            icon: self
                .icons
                .contains_key(&key)
                .then(|| protocol::url(ICON_SCHEME, &key)),
        };
        self.entries.retain(|e| e.item.id != item.id);
        self.entries.insert(
            0,
            Entry {
                item: item.clone(),
                app_id: raw.app_id,
            },
        );
        self.entries.truncate(MAX_ITEMS);
        item
    }

    fn remove(&mut self, id: u32) -> bool {
        let before = self.entries.len();
        self.entries.retain(|e| e.item.id != id);
        self.entries.len() != before
    }

    fn items(&self) -> Vec<NotificationItem> {
        self.entries.iter().map(|e| e.item.clone()).collect()
    }
}

fn changed(app: &AppHandle) {
    if let Err(e) = app.emit(CHANGED_EVENT, store().items()) {
        log::warn!("could not send the notifications: {e}");
    }
}

fn on_event(app: &AppHandle, event: NotificationEvent) {
    match event {
        NotificationEvent::Added(_) if !crate::settings::get().notifications.enabled => {}
        NotificationEvent::Added(raw) => {
            let item = store().add(raw);
            changed(app);
            // Do not disturb: kept in the tab, not announced.
            if platform::notifications_quiet() {
                return;
            }
            peeks::announce(
                app,
                SystemPeek::Notification {
                    id: item.id,
                    app: item.app,
                    title: item.title,
                    body: item.body,
                    icon: item.icon,
                },
            );
        }
        NotificationEvent::Removed(id) => {
            if store().remove(id) {
                changed(app);
            }
        }
    }
}

/// Empties the list (the notifications stay in Windows' centre).
pub fn clear_all(app: &AppHandle) {
    store().entries.clear();
    changed(app);
}

pub fn start(app: &AppHandle) {
    let app = app.clone();
    platform::start_notification_watch(move |event| on_event(&app, event));
}

#[tauri::command]
pub fn notifications_items() -> Vec<NotificationItem> {
    store().items()
}

/// Opens the app that sent it; the notification is then done with.
#[tauri::command]
pub fn notification_open(app: AppHandle, id: u32) -> Result<(), String> {
    let app_id = store()
        .entries
        .iter()
        .find(|e| e.item.id == id)
        .map(|e| e.app_id.clone())
        .ok_or("no such notification")?;
    platform::launch_app(&app_id)?;
    notification_dismiss(app, id);
    Ok(())
}

/// Removes it here and from the notification centre.
#[tauri::command]
pub fn notification_dismiss(app: AppHandle, id: u32) {
    store().remove(id);
    platform::dismiss_notification(id);
    changed(&app);
}

#[tauri::command]
pub fn notifications_clear(app: AppHandle) {
    let ids: Vec<u32> = store().entries.drain(..).map(|e| e.item.id).collect();
    for id in ids {
        platform::dismiss_notification(id);
    }
    changed(&app);
}

/// Whether a link from a notification may be opened: web and mail only.
pub fn is_openable(url: &str) -> bool {
    ["https://", "http://", "mailto:"]
        .iter()
        .any(|scheme| url.len() > scheme.len() && url[..scheme.len()].eq_ignore_ascii_case(scheme))
}

/// Opens a link found in a notification, in the default browser.
#[tauri::command]
pub fn open_link(app: AppHandle, url: String) -> Result<(), String> {
    if !is_openable(&url) {
        return Err("only web and mail links open".into());
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

/// Serves an app icon: `/<key>`.
pub fn serve_icon(path: &str) -> Response<Vec<u8>> {
    let key = path.trim_start_matches('/');
    let icon = store().icons.get(key).cloned();
    let response = match icon {
        Some(icon) => Response::builder()
            .header(header::CONTENT_TYPE, icon.mime)
            .header(header::CACHE_CONTROL, "max-age=3600")
            .body(icon.bytes),
        None => Response::builder()
            .status(StatusCode::NOT_FOUND)
            // Not cached by the web view: it may come later.
            .header(header::CACHE_CONTROL, "no-store")
            .body(Vec::new()),
    };
    response.unwrap_or_else(|_| Response::new(Vec::new()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn raw(id: u32, app_id: &str, icon: bool) -> RawNotification {
        RawNotification {
            id,
            app_id: app_id.into(),
            app_name: "App".into(),
            title: format!("t{id}"),
            body: String::new(),
            arrived_ms: u64::from(id),
            icon: icon.then(|| Artwork {
                bytes: vec![1],
                mime: "image/png".into(),
            }),
        }
    }

    #[test]
    fn diff_finds_new_and_gone() {
        let known: HashSet<u32> = [1, 2, 3].into();
        assert_eq!(diff(&known, &[2, 3, 4, 5]), (vec![4, 5], vec![1]));
        assert_eq!(diff(&HashSet::new(), &[]), (vec![], vec![]));
    }

    #[test]
    fn newest_first_capped_and_icons_shared_by_app() {
        let mut s = Store::default();
        let first = s.add(raw(1, "Discord", true));
        let second = s.add(raw(2, "Discord", false));
        assert!(first.icon.is_some());
        assert_eq!(first.icon, second.icon, "the app's icon is reused");
        assert_eq!(s.items()[0].id, 2);
        for id in 3..(MAX_ITEMS as u32 + 10) {
            s.add(raw(id, "x", false));
        }
        assert_eq!(s.items().len(), MAX_ITEMS);
        assert!(s.remove(MAX_ITEMS as u32 + 9));
        assert!(!s.remove(1), "the oldest left already");
    }

    #[test]
    fn only_web_and_mail_links_open() {
        assert!(is_openable("https://discord.com/channels/1"));
        assert!(is_openable("HTTP://example.com"));
        assert!(is_openable("mailto:a@b.c"));
        assert!(!is_openable("file:///C:/Windows/System32/calc.exe"));
        assert!(!is_openable("javascript:alert(1)"));
        assert!(!is_openable("https://"));
    }
}
