import { invoke } from "@tauri-apps/api/core";

/**
 * What the running platform supports, as reported by the backend
 * (`src-tauri/src/platform`). Modules hide themselves when their
 * capability is missing, so a port never needs UI changes.
 */
export interface Capabilities {
  platform: "windows" | "macos" | "linux" | "other";
  islandWindow: boolean;
  media: boolean;
  volume: boolean;
  power: boolean;
}

export type Feature = Exclude<keyof Capabilities, "platform">;

/** Used until the backend answers, and in a plain browser (no Tauri). */
export const NO_CAPABILITIES: Capabilities = {
  platform: "other",
  islandWindow: false,
  media: false,
  volume: false,
  power: false,
};

export function isSupported(caps: Capabilities, feature: Feature): boolean {
  return caps[feature] === true;
}

export async function fetchCapabilities(): Promise<Capabilities> {
  return invoke<Capabilities>("get_capabilities");
}
