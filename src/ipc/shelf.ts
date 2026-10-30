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
/** Mirrors `PhoneLink` in `src-tauri/src/share.rs`. */
export interface PhoneLink {
  /** Ends the link early (`stopPhoneShare`). */
  token: string;
  url: string;
  /** Modules per side of the QR code, without its margin. */
  qrSize: number;
  /** SVG path of the dark modules, one unit per module. */
  qrPath: string;
  expiresInSecs: number;
}

/** A link on the local network to these items' files, as a QR code for a phone's camera. */
export const shareToPhone = (ids: number[]) => invoke<PhoneLink>("shelf_share_phone", { ids });
/** Ends a link before its time: its files are no longer served. */
export const stopPhoneShare = (token: string) => invoke<void>("shelf_share_stop", { token });
/** Opens Windows' Share panel with these items' files. */
export const shareWithWindows = (ids: number[]) => invoke<void>("shelf_share_windows", { ids });
/** Path of a PNG to show under the cursor while dragging the item out. */
export const dragIcon = (id: number) => invoke<string>("shelf_drag_icon", { id });

interface WebView2 {
  postMessageWithAdditionalObjects(message: string, objects: FileList): void;
}

/**
 * Hands dropped files to the backend, which reads their paths (mirrors
 * `DROP_MESSAGE` in `src-tauri/src/platform/windows/file_drop.rs`).
 */
export function sendDroppedFiles(files: FileList): void {
  const webview = (window as { chrome?: { webview?: WebView2 } }).chrome?.webview;
  webview?.postMessageWithAdditionalObjects("quiera://drop", files);
}

export function onShelf(callback: (items: ShelfItem[]) => void): Promise<UnlistenFn> {
  return listen<ShelfItem[]>("shelf://changed", (event) => callback(event.payload));
}
