mod island;
mod lyrics;
mod media;
mod peeks;
mod platform;
mod protocol;
mod recovery;
mod shelf;
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

/// Development aid: puts files on the shelf as if they had been dropped
/// (debug builds only), to check the shelf without a real drag.
#[tauri::command]
fn dev_shelf_add(app: tauri::AppHandle, paths: Vec<String>) {
    if cfg!(debug_assertions) {
        shelf::add_paths(&app, paths.into_iter().map(Into::into).collect());
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
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_drag::init())
        .register_uri_scheme_protocol(media::ART_SCHEME, |_ctx, request| {
            media::serve_artwork(request.uri().path())
        })
        .register_asynchronous_uri_scheme_protocol(
            shelf::THUMB_SCHEME,
            |_ctx, request, responder| {
                shelf::queue_thumbnail(request.uri().path().to_owned(), responder);
            },
        )
        .setup(|app| {
            tray::create(app)?;
            island::setup(app.handle())?;
            recovery::watch(app.handle());
            system::start(app.handle());
            media::start(app.handle());
            peeks::start(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != island::LABEL {
                return;
            }
            match event {
                tauri::WindowEvent::ScaleFactorChanged { .. } => {
                    if let Some(island) = window.app_handle().get_webview_window(island::LABEL)
                        && let Err(e) = island::place(&island)
                    {
                        log::warn!("could not re-place the island after a scale change: {e}");
                    }
                }
                tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) => {
                    shelf::add_paths(window.app_handle(), paths.clone());
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_capabilities,
            island::set_island_region,
            system::get_fullscreen,
            media::get_media,
            media::media_play_pause,
            media::media_next,
            media::media_previous,
            media::media_seek,
            media::media_set_shuffle,
            media::media_set_repeat,
            lyrics::lyrics_word_synced,
            shelf::shelf_items,
            shelf::shelf_remove,
            shelf::shelf_clear,
            shelf::shelf_open,
            shelf::shelf_reveal,
            shelf::shelf_drag_icon,
            dev_log,
            dev_bench_requested,
            dev_shelf_add
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
