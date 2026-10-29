//! Notifications on Windows, read with `UserNotificationListener`: the app,
//! its icon, and the texts of each toast in the notification centre.
//!
//! Windows only gives listeners the visuals: a toast's buttons and reply
//! box stay with the app that sent it. The listener's change event is not
//! always available outside the Store; the centre is then checked every
//! second (one cheap call).

use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::mpsc::{self, Sender};
use std::time::Duration;

use windows::Foundation::{Size, TypedEventHandler};
use windows::UI::Notifications::Management::{
    UserNotificationListener, UserNotificationListenerAccessStatus,
};
use windows::UI::Notifications::{
    KnownNotificationBindings, NotificationKinds, ToastNotificationManager, ToastNotificationMode,
    UserNotification, UserNotificationChangedEventArgs,
};
use windows::Win32::System::Com::{COINIT_MULTITHREADED, CoInitializeEx};
use windows::core::Interface;

use super::media::{read_artwork, unix_ms};
use crate::media::Artwork;
use crate::notifications::{NotificationEvent, RawNotification, diff};

const POLL: Duration = Duration::from_secs(1);
const ICON_SIZE: f32 = 64.0;

pub fn start_notification_watch(handler: impl Fn(NotificationEvent) + Send + 'static) {
    let spawned = std::thread::Builder::new()
        .name("quiera-notifications".into())
        .spawn(move || {
            if let Err(e) = run(handler) {
                log::warn!("notifications unavailable: {e}");
            }
        });
    if let Err(e) = spawned {
        log::error!("could not start the notification watcher: {e}");
    }
}

fn run(handler: impl Fn(NotificationEvent)) -> windows::core::Result<()> {
    // SAFETY: COM for this worker thread only; the blocking joins need MTA.
    unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) }.ok()?;
    let listener = UserNotificationListener::Current()?;
    let mut status = listener.GetAccessStatus()?;
    if status == UserNotificationListenerAccessStatus::Unspecified {
        status = listener.RequestAccessAsync()?.join()?;
    }
    if status != UserNotificationListenerAccessStatus::Allowed {
        log::warn!("notifications: access {status:?} (Settings › Privacy › Notifications)");
        return Ok(());
    }

    let (tx, rx) = mpsc::channel::<()>();
    let evented = subscribe(&listener, &tx);
    if !evented {
        std::thread::Builder::new()
            .name("quiera-notifications-poll".into())
            .spawn(move || {
                while tx.send(()).is_ok() {
                    std::thread::sleep(POLL);
                }
            })
            .map_err(|e| windows::core::Error::new(windows::core::HRESULT(-1), e.to_string()))?;
    }
    log::info!(
        "notification watcher started ({})",
        if evented { "events" } else { "polling" }
    );

    // What is already in the centre is not news.
    let mut known: HashSet<u32> = current(&listener)?
        .iter()
        .filter_map(|n| n.Id().ok())
        .collect();
    let mut icons: HashMap<String, Option<Artwork>> = HashMap::new();

    for () in rx {
        let Ok(list) = current(&listener) else {
            continue;
        };
        let ids: Vec<u32> = list.iter().filter_map(|n| n.Id().ok()).collect();
        let (added, removed) = diff(&known, &ids);
        for id in removed {
            handler(NotificationEvent::Removed(id));
        }
        for n in list
            .iter()
            .filter(|n| n.Id().is_ok_and(|id| added.contains(&id)))
        {
            if let Some(raw) = read(n, &mut icons) {
                handler(NotificationEvent::Added(raw));
            }
        }
        known = ids.into_iter().collect();
    }
    Ok(())
}

/// The change event, when Windows allows it for this app.
fn subscribe(listener: &UserNotificationListener, tx: &Sender<()>) -> bool {
    let tx = tx.clone();
    let handler =
        TypedEventHandler::<UserNotificationListener, UserNotificationChangedEventArgs>::new(
            move |_, _| {
                let _ = tx.send(());
                Ok(())
            },
        );
    listener.NotificationChanged(&handler).is_ok()
}

fn current(listener: &UserNotificationListener) -> windows::core::Result<Vec<UserNotification>> {
    let list = listener
        .GetNotificationsAsync(NotificationKinds::Toast)?
        .join()?;
    Ok(list.into_iter().collect())
}

fn read(
    n: &UserNotification,
    icons: &mut HashMap<String, Option<Artwork>>,
) -> Option<RawNotification> {
    let app = n.AppInfo().ok()?;
    let app_id = app.AppUserModelId().ok()?.to_string();
    let display = app.DisplayInfo().ok()?;
    let app_name = display
        .DisplayName()
        .map(|s| s.to_string())
        .unwrap_or_default();
    let texts: Vec<String> = n
        .Notification()
        .and_then(|n| n.Visual())
        .and_then(|v| v.GetBinding(&KnownNotificationBindings::ToastGeneric()?))
        .and_then(|b| b.GetTextElements())
        .map(|list| {
            list.into_iter()
                .filter_map(|t| t.Text().ok())
                .map(|t| t.to_string())
                .collect()
        })
        .unwrap_or_default();
    let mut texts = texts.into_iter().filter(|t| !t.trim().is_empty());
    let title = texts.next().unwrap_or_default();
    let body = texts.collect::<Vec<_>>().join("\n");
    let icon = icons
        .entry(app_id.clone())
        .or_insert_with(|| {
            display
                .GetLogo(Size {
                    Width: ICON_SIZE,
                    Height: ICON_SIZE,
                })
                .and_then(|logo| read_artwork(&logo.cast()?))
                .ok()
                .or_else(|| shell_icon(&app_id))
        })
        .clone();
    Some(RawNotification {
        id: n.Id().ok()?,
        app_id,
        app_name,
        title,
        body,
        arrived_ms: n
            .CreationTime()
            .map(|t| unix_ms(t.UniversalTime))
            .unwrap_or(0),
        icon,
    })
}

/// Classic (non-Store) apps have no logo for listeners: their Start menu
/// icon then, from the shell. On its own thread, as the shell wants a
/// single-threaded apartment and this worker is multithreaded.
fn shell_icon(app_id: &str) -> Option<Artwork> {
    let item = format!("shell:AppsFolder\\{app_id}");
    let size = ICON_SIZE as u32;
    let png = std::thread::spawn(move || super::file_thumbnail(Path::new(&item), size))
        .join()
        .ok()??;
    Some(Artwork {
        bytes: png,
        mime: "image/png".into(),
    })
}

/// Whether Windows holds banners back (Do not disturb, focus): anything
/// but the normal mode.
pub fn notifications_quiet() -> bool {
    ToastNotificationManager::GetDefault()
        .and_then(|m| m.NotificationMode())
        .is_ok_and(|mode| mode != ToastNotificationMode::Unrestricted)
}

/// Removes a notification from the notification centre.
pub fn dismiss_notification(id: u32) {
    if let Ok(listener) = UserNotificationListener::Current() {
        let _ = listener.RemoveNotification(id);
    }
}

/// Opens the app that sent a notification, by its app user model id.
pub fn launch_app(app_id: &str) -> Result<(), String> {
    std::process::Command::new("explorer.exe")
        .arg(format!("shell:AppsFolder\\{app_id}"))
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}
