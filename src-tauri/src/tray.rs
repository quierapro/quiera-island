//! Notification-area icon: the only way to quit, since the island has no
//! window frame.

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Wry};

use crate::i18n::tr;

const QUIT: &str = "quit";
const SETTINGS: &str = "settings";
const UPDATE: &str = "update";

/// The menu's items, renamed when the language changes or an update is found.
struct Items {
    settings: MenuItem<Wry>,
    update: MenuItem<Wry>,
    quit: MenuItem<Wry>,
}

pub fn create(app: &tauri::App) -> tauri::Result<()> {
    let settings = MenuItem::with_id(app, SETTINGS, "", true, None::<&str>)?;
    let update = MenuItem::with_id(app, UPDATE, "", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, QUIT, "", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&settings, &update, &quit])?;
    app.manage(Items {
        settings,
        update,
        quit,
    });
    refresh(app.handle());
    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("Quiera")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| {
            if event.id() == SETTINGS {
                crate::settings::open_window(app);
            } else if event.id() == UPDATE {
                crate::updates::tray_clicked(app);
            } else if event.id() == QUIT {
                log::info!("quit requested from the tray");
                app.exit(0);
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

/// Sets the menu's texts: in the current language, the update item naming
/// the version found if there is one.
pub fn refresh(app: &AppHandle) {
    let Some(items) = app.try_state::<Items>() else {
        return;
    };
    let _ = items.settings.set_text(tr("Réglages…", "Settings…"));
    let _ = items.quit.set_text(tr("Quitter Quiera", "Quit Quiera"));
    let update = match crate::updates::available() {
        Some(version) => format!(
            "{} {version}",
            tr("Installer la mise à jour", "Install update")
        ),
        None => tr("Rechercher des mises à jour", "Check for updates").to_owned(),
    };
    let _ = items.update.set_text(update);
}
