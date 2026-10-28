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
