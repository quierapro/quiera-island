import { invoke } from "@tauri-apps/api/core";

export type RadioKind = "wifi" | "bluetooth";

/** Mirrors `Controls` in `src-tauri/src/controls.rs`. */
export interface Controls {
  radios: { kind: RadioKind; on: boolean }[];
  outputs: { id: string; name: string; form: "headphones" | "headset" | "speakers" | "other"; default: boolean }[];
  volume: { level: number; muted: boolean } | null;
  apps: { key: string; name: string; icon: string; level: number; muted: boolean }[];
}

export const getControls = () => invoke<Controls>("controls_state");
export const setRadio = (kind: RadioKind, on: boolean) => invoke<void>("controls_set_radio", { kind, on });
export const setOutput = (id: string) => invoke<void>("controls_set_output", { id });
export const setVolume = (level: number) => invoke<void>("controls_set_volume", { level });
export const setMute = (muted: boolean) => invoke<void>("controls_set_mute", { muted });
export const setAppVolume = (key: string, level: number) => invoke<void>("controls_set_app_volume", { key, level });
export const setAppMute = (key: string, muted: boolean) => invoke<void>("controls_set_app_mute", { key, muted });
