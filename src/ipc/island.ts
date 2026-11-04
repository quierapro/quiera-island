import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** A rectangle in the island window's CSS pixels. */
export interface RegionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Limits drawing and clicks of the island window to `rects`. */
export function setIslandRegion(rects: RegionRect[]): Promise<void> {
  return invoke("set_island_region", { rects });
}

/** Closed, the island lets clicks go to the window under it (`true`). */
export function setIslandPassThrough(on: boolean): void {
  invoke("island_pass_through", { on }).catch(() => {});
}

/** Whether the island's shortcut works (another app may hold it). */
export const islandShortcutHeld = () => invoke<boolean>("island_shortcut_held");

/** While a shortcut is recorded, the current one lets its keys through. */
export function setShortcutRecording(recording: boolean): void {
  invoke("island_shortcut_recording", { recording }).catch(() => {});
}

/** The island's shortcut was pressed: show it, or hide it. */
export function onIslandToggle(callback: () => void): Promise<UnlistenFn> {
  return listen("island://toggle", () => callback());
}

/** The pointer came onto the closed island, or left it (clicks still going through). */
export function onIslandNear(callback: (near: boolean) => void): Promise<UnlistenFn> {
  return listen<boolean>("island://near", (event) => callback(event.payload));
}

/** The pointer rested on the island while clicks went through: it should open. */
export function onIslandRest(callback: () => void): Promise<UnlistenFn> {
  return listen("island://rest", () => callback());
}

/** Asks WebView2 to keep its memory low (the island is closed) or not. */
export function setIslandMemory(low: boolean): void {
  invoke("island_memory", { low }).catch(() => {});
}
