//! Notification-area icon: the only way to quit, since the island has no
//! window frame.

use tauri::Manager;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;

const QUIT: &str = "quit";
const SETTINGS: &str = "settings";
const UPDATE: &str = "update";

pub fn create(app: &tauri::App) -> tauri::Result<()> {
    let settings = MenuItem::with_id(app, SETTINGS, "Réglages…", true, None::<&str>)?;
    let update = MenuItem::with_id(
        app,
        UPDATE,
        "Rechercher des mises à jour",
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, QUIT, "Quitter Quiera", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&settings, &update, &quit])?;
    // Renamed when a new version is found.
    app.manage(crate::updates::TrayItem(update));
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
