import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type Shortcut = "Alt+Espace" | "Ctrl+Alt+Espace" | "Ctrl+Maj+Espace" | "Alt+Q";
/** A shortcut people record (mirrors `Hotkey` in `src-tauri/src/settings.rs`): `key` 0 for none. */
export interface Hotkey {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  win: boolean;
  /** Windows' virtual-key code. */
  key: number;
  label: string;
  /** A key alone pressed twice in a row (Ctrl, Ctrl). */
  double: boolean;
}
export const SHORTCUTS: Shortcut[] = ["Alt+Espace", "Ctrl+Alt+Espace", "Ctrl+Maj+Espace", "Alt+Q"];

/** The interface's language: Windows' display language, or one chosen. */
export type Language = "system" | "fr" | "en";

/** Mirrors `Settings` in `src-tauri/src/settings.rs`. */
export interface Settings {
  version: number;
  general: {
    startWithWindows: boolean;
    /** A monitor's name; null for the primary monitor. */
    screen: string | null;
    hideInFullscreen: boolean;
    openOnHover: boolean;
    /** Closed, the island lets clicks go to the window under it; it opens when the pointer rests on it. */
    passThrough: boolean;
    islandShortcut: Hotkey;
    motion: "system" | "reduced" | "full";
    /** Looks for a new version now and then. */
    checkUpdates: boolean;
    language: Language;
  };
  /** The island's tabs: their order (empty: the default one) and the hidden ones. */
  tabs: { order: string[]; hidden: string[] };
  /** iCal links (secret), and how long before a meeting the island says so. */
  calendar: { links: string[]; remindMinutes: number };
  launcher: { enabled: boolean; shortcut: Shortcut; indexFiles: boolean };
  media: { lyrics: boolean; netease: boolean; lyricsOffsetMs: number };
  notifications: { enabled: boolean; peek: boolean };
  clipboard: { enabled: boolean };
  peeks: { power: boolean; audioDevice: boolean; bluetooth: boolean; capsLock: boolean; volume: boolean };
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
  general: { startWithWindows: false, screen: null, hideInFullscreen: true, openOnHover: true, passThrough: true, islandShortcut: { ctrl: true, alt: true, shift: false, win: false, key: 0x49, label: "Ctrl+Alt+I", double: false }, motion: "system", checkUpdates: true, language: "system" },
  tabs: { order: [], hidden: [] },
  calendar: { links: [], remindMinutes: 10 },
  launcher: { enabled: true, shortcut: "Alt+Espace", indexFiles: true },
  media: { lyrics: true, netease: false, lyricsOffsetMs: 0 },
  notifications: { enabled: true, peek: true },
  clipboard: { enabled: true },
  peeks: { power: true, audioDevice: true, bluetooth: true, capsLock: true, volume: true },
  shelf: { keep: false },
};

/**
 * The settings with every section and field present: what the backend
 * sends, completed from the defaults. A backend older than the interface
 * (in development, the interface reloads before the backend is rebuilt)
 * never leaves a section undefined.
 */
export function completeSettings(sent: Partial<Settings> | null | undefined): Settings {
  const out: Record<string, unknown> = {};
  for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS)) {
    const value = (sent as Record<string, unknown> | null | undefined)?.[key];
    const isSection = typeof fallback === "object" && fallback !== null && !Array.isArray(fallback);
    out[key] = isSection && typeof value === "object" && value !== null ? { ...fallback, ...value } : (value ?? fallback);
  }
  return out as unknown as Settings;
}

export const getSettings = () => invoke<Settings>("settings_get").then(completeSettings);
export const saveSettings = (settings: Settings) => invoke<void>("settings_set", { settings });
export const openSettings = () => invoke<void>("settings_open");
export const getMonitors = () => invoke<Monitor[]>("settings_monitors");
/** The launcher shortcut held now (null when none could be). */
export const getHeldShortcut = () => invoke<Shortcut | null>("launcher_shortcut");

export function onSettings(callback: (settings: Settings) => void): Promise<UnlistenFn> {
  return listen<Settings>("settings://changed", (event) => callback(completeSettings(event.payload)));
}
