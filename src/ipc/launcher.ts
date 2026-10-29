import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** Mirrors `LauncherApp` in `src-tauri/src/launcher.rs`. */
export interface LauncherApp {
  key: string;
  name: string;
  icon: string;
}

export const getLauncherApps = () => invoke<LauncherApp[]>("launcher_apps");
/** The shortcut the launcher got ("Alt+Espace"), or null when none was free. */
export const getLauncherShortcut = () => invoke<string | null>("launcher_shortcut");
export const launchApp = (key: string) => invoke<void>("launcher_launch", { key });
/** `restore`: give the keyboard back to the window that had it. */
export const closeLauncher = (restore: boolean) => invoke<void>("launcher_close", { restore });

export function onLauncher(open: () => void, close: () => void): Promise<UnlistenFn> {
  return Promise.all([listen("launcher://open", open), listen("launcher://close", close)]).then(
    (stops) => () => stops.forEach((stop) => stop()),
  );
}

/** Mirrors `FileHit` in `src-tauri/src/files.rs`. */
export interface FileHit {
  id: number;
  generation: number;
  name: string;
  /** The folder it is in. */
  folder: string;
  dir: boolean;
  icon: string;
  /** Last change, in seconds since 1970 (0 when unknown). */
  modified: number;
}

export const searchFiles = (query: string, limit: number) =>
  invoke<{ ready: boolean; hits: FileHit[] }>("launcher_files", { query, limit });
/** Opens it, or with `reveal` shows it in Explorer. */
export const openFile = (hit: FileHit, reveal: boolean) =>
  invoke<void>("launcher_open_file", { id: hit.id, generation: hit.generation, reveal });
