import { invoke } from "@tauri-apps/api/core";

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

/** Asks WebView2 to keep its memory low (the island is closed) or not. */
export function setIslandMemory(low: boolean): void {
  invoke("island_memory", { low }).catch(() => {});
}
