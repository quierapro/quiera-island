import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** Mirrors `TabSpec` in `src-tauri/src/plugins/manifest.rs`. */
export interface PluginTabSpec {
  when: "always" | "content";
  size: [number, number];
}

/** Mirrors `PluginInfo` in `src-tauri/src/plugins/mod.rs`. */
export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  icon: string;
  network: string[];
  tab: PluginTabSpec | null;
  folder: string;
  enabled: boolean;
  running: boolean;
  needsConsent: boolean;
  error: string | null;
}

/** What a running plugin shows; the trees are checked by the renderer. */
export interface PluginView {
  id: string;
  tab: unknown;
  activity: unknown;
}

export interface PluginPeekEvent {
  id: string;
  peek: unknown;
}

export interface LogLine {
  at: number;
  level: "info" | "log" | "warn" | "error";
  text: string;
}

export const getPlugins = () => invoke<PluginInfo[]>("plugins_list");
export const getPluginViews = () => invoke<PluginView[]>("plugins_views");
export const getPluginLogs = (id: string) => invoke<LogLine[]>("plugin_logs", { id });
export const openPluginsFolder = () => invoke<void>("plugins_open_folder");

export function sendPluginEvent(id: string, kind: "open" | "close" | "action", action?: string, value?: unknown): Promise<void> {
  return invoke<void>("plugin_event", { id, kind, action, value });
}

export const onPlugins = (cb: (list: PluginInfo[]) => void): Promise<UnlistenFn> =>
  listen<PluginInfo[]>("plugins://list", (e) => cb(e.payload));
export const onPluginViews = (cb: (views: PluginView[]) => void): Promise<UnlistenFn> =>
  listen<PluginView[]>("plugins://views", (e) => cb(e.payload));
export const onPluginPeek = (cb: (peek: PluginPeekEvent) => void): Promise<UnlistenFn> =>
  listen<PluginPeekEvent>("plugins://peek", (e) => cb(e.payload));
