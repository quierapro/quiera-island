import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** Mirrors `ClipItem` in `src-tauri/src/clipboard.rs`. */
export interface ClipItem {
  id: number;
  kind: "text" | "link" | "image";
  /** Text on one line, the link, or the image's size. */
  preview: string;
  /** The site, for links. */
  host: string | null;
  /** Thumbnail URL, for images. */
  thumbnail: string | null;
  pinned: boolean;
  /** Unix ms of the last copy. */
  copiedAt: number;
}

export const getClipboard = () => invoke<ClipItem[]>("clipboard_items");
export const copyItem = (id: number) => invoke<void>("clipboard_copy", { id });
export const pinItem = (id: number, pinned: boolean) => invoke<void>("clipboard_pin", { id, pinned });
export const removeClip = (id: number) => invoke<void>("clipboard_remove", { id });
/** Empties the history, except what is pinned. */
export const clearClipboard = () => invoke<void>("clipboard_clear");

export function onClipboard(callback: (items: ClipItem[]) => void): Promise<UnlistenFn> {
  return listen<ClipItem[]>("clipboard://changed", (event) => callback(event.payload));
}
