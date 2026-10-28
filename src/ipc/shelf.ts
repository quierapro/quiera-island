import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** Mirrors `ShelfItem` in `src-tauri/src/shelf.rs`. */
export interface ShelfItem {
  id: number;
  path: string;
  name: string;
  kind: "file" | "folder" | "image";
  /** Bytes, for files. */
  size: number | null;
  /** Thumbnail URL (shell preview or file type icon). */
  thumbnail: string;
}

export const getShelf = () => invoke<ShelfItem[]>("shelf_items");
export const removeItem = (id: number) => invoke<void>("shelf_remove", { id });
export const clearShelf = () => invoke<void>("shelf_clear");
export const openItem = (id: number) => invoke<void>("shelf_open", { id });
export const revealItem = (id: number) => invoke<void>("shelf_reveal", { id });
/** Path of a PNG to show under the cursor while dragging the item out. */
export const dragIcon = (id: number) => invoke<string>("shelf_drag_icon", { id });

export function onShelf(callback: (items: ShelfItem[]) => void): Promise<UnlistenFn> {
  return listen<ShelfItem[]>("shelf://changed", (event) => callback(event.payload));
}
