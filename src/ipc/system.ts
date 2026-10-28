import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** True while a fullscreen app covers the island's monitor. */
export function getFullscreen(): Promise<boolean> {
  return invoke<boolean>("get_fullscreen");
}

export function onFullscreen(callback: (fullscreen: boolean) => void): Promise<UnlistenFn> {
  return listen<boolean>("system://fullscreen", (event) => callback(event.payload));
}
