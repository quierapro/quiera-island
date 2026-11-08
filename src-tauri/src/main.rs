// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Started by an AI agent's hook: pass its event on and exit, without
    // starting the app.
    let mut args = std::env::args().skip(1);
    match args.next().as_deref() {
        Some(quiera_lib::AGENT_EVENT_ARG) => {
            quiera_lib::run_agent_hook(&args.next().unwrap_or_default());
            return;
        }
        Some(quiera_lib::AGENT_STATUS_ARG) => {
            quiera_lib::run_agent_status(&args.next().unwrap_or_default());
            return;
        }
        _ => {}
    }
    quiera_lib::run()
}
