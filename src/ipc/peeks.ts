import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** Mirrors `SystemPeek` in `src-tauri/src/peeks.rs`. */
export type SystemPeek =
  | { kind: "power"; plugged: boolean; percent: number | null }
  | { kind: "audioDevice"; name: string; form: "headphones" | "headset" | "speakers" | "other"; battery: number | null }
  | { kind: "capsLock"; on: boolean }
  | { kind: "update"; version: string }
  | { kind: "volume"; level: number; muted: boolean }
  | { kind: "copied"; content: "text" | "link" | "image"; preview: string; thumbnail: string | null }
  | { kind: "notification"; id: number; app: string; title: string; body: string; icon: string | null };

export function onSystemPeek(callback: (peek: SystemPeek) => void): Promise<UnlistenFn> {
  return listen<SystemPeek>("system://peek", (event) => callback(event.payload));
}
