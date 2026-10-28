mod island;
mod platform;
mod recovery;
mod system;
mod tray;

use platform::Capabilities;
use tauri::Manager;

/// What this platform supports; the frontend hides modules accordingly.
#[tauri::command]
fn get_capabilities() -> Capabilities {
    platform::capabilities()
}

/// Development aid: lets the frontend write to the log. Ignored in release builds.
#[tauri::command]
fn dev_log(message: String) {
    if cfg!(debug_assertions) {
        log::info!("[dev] {message}");
    }
}

/// Development aid: true when started with QUIERA_BENCH set (debug builds only).
#[tauri::command]
fn dev_bench_requested() -> bool {
    cfg!(debug_assertions) && std::env::var_os("QUIERA_BENCH").is_some()
}

pub fn run() {
    log_panics();
    recovery::on_startup();
    tauri::Builder::default()
        // Must be registered first so a second launch exits before doing anything.
        .plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {
            log::info!("second instance blocked");
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
                .build(),
        )
        .setup(|app| {
            tray::create(app)?;
            island::setup(app.handle())?;
            recovery::watch(app.handle());
            system::start(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == island::LABEL
                && matches!(event, tauri::WindowEvent::ScaleFactorChanged { .. })
                && let Some(island) = window.app_handle().get_webview_window(island::LABEL)
                && let Err(e) = island::place(&island)
            {
                log::warn!("could not re-place the island after a scale change: {e}");
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_capabilities,
            island::set_island_region,
            system::get_fullscreen,
            dev_log,
            dev_bench_requested
        ])
        .run(tauri::generate_context!())
        .expect("error while running Quiera");
}

/// Sends panics to the log file before the default handler runs.
fn log_panics() {
    let default = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        log::error!("panic: {info}");
        default(info);
    }));
}
