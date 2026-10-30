import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** Mirrors `Status` in `src-tauri/src/updates.rs`. */
export interface UpdateStatus {
  current: string;
  /** The newer version found, if any. */
  available: string | null;
  checking: boolean;
  installing: boolean;
  /** Why the last check or install failed. */
  error: string | null;
}

export const getUpdateStatus = () => invoke<UpdateStatus>("updates_status");
export const checkForUpdates = () => invoke<void>("updates_check");
/** Downloads, verifies and installs: Quiera closes and comes back updated. */
export const installUpdate = () => invoke<void>("updates_install");

export function onUpdateStatus(callback: (status: UpdateStatus) => void): Promise<UnlistenFn> {
  return listen<UpdateStatus>("updates://status", (event) => callback(event.payload));
}
