import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type Shortcut = "Alt+Espace" | "Ctrl+Alt+Espace" | "Ctrl+Maj+Espace" | "Alt+Q";
export const SHORTCUTS: Shortcut[] = ["Alt+Espace", "Ctrl+Alt+Espace", "Ctrl+Maj+Espace", "Alt+Q"];

/** Mirrors `Settings` in `src-tauri/src/settings.rs`. */
export interface Settings {
  version: number;
  general: {
    startWithWindows: boolean;
    /** A monitor's name; null for the primary monitor. */
    screen: string | null;
    hideInFullscreen: boolean;
    openOnHover: boolean;
    motion: "system" | "reduced" | "full";
    /** Looks for a new version now and then. */
    checkUpdates: boolean;
  };
  launcher: { enabled: boolean; shortcut: Shortcut; indexFiles: boolean };
  media: { lyrics: boolean; netease: boolean; lyricsOffsetMs: number };
  notifications: { enabled: boolean; peek: boolean };
  clipboard: { enabled: boolean };
  peeks: { power: boolean; audioDevice: boolean; capsLock: boolean; volume: boolean };
  shelf: { keep: boolean };
}

/** Mirrors `MonitorInfo` in `src-tauri/src/island/mod.rs`. */
export interface Monitor {
  name: string;
  width: number;
  height: number;
  primary: boolean;
}

/** The defaults, as the backend has them, until it answers. */
export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  general: { startWithWindows: false, screen: null, hideInFullscreen: true, openOnHover: true, motion: "system", checkUpdates: true },
  launcher: { enabled: true, shortcut: "Alt+Espace", indexFiles: true },
  media: { lyrics: true, netease: false, lyricsOffsetMs: 0 },
  notifications: { enabled: true, peek: true },
  clipboard: { enabled: true },
  peeks: { power: true, audioDevice: true, capsLock: true, volume: true },
  shelf: { keep: false },
};

export const getSettings = () => invoke<Settings>("settings_get");
export const saveSettings = (settings: Settings) => invoke<void>("settings_set", { settings });
export const openSettings = () => invoke<void>("settings_open");
export const getMonitors = () => invoke<Monitor[]>("settings_monitors");
/** The launcher shortcut held now (null when none could be). */
export const getHeldShortcut = () => invoke<Shortcut | null>("launcher_shortcut");

export function onSettings(callback: (settings: Settings) => void): Promise<UnlistenFn> {
  return listen<Settings>("settings://changed", (event) => callback(event.payload));
}
