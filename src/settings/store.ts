/**
 * The settings in force, shared by the island and the settings window: read
 * once from the backend, then updated whenever they are saved (from either
 * window).
 */
import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, getSettings, onSettings, saveSettings, type Settings } from "../ipc/settings";

let current: Settings = DEFAULT_SETTINGS;
const listeners = new Set<() => void>();
let started = false;

function publish(next: Settings) {
  current = next;
  for (const l of listeners) l();
}

function start() {
  if (started) return;
  started = true;
  onSettings(publish)
    .then(() => getSettings())
    .then(publish)
    .catch(() => {});
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => current);
}

/** The settings now, outside React. */
export function settingsNow(): Settings {
  start();
  return current;
}

/** Changes one part of the settings and saves them. */
export function updateSettings(change: (draft: Settings) => Settings): Promise<void> {
  const next = change(current);
  publish(next);
  return saveSettings(next).catch((e) => {
    // Saving failed: what is in force is still the old file's.
    getSettings().then(publish).catch(() => {});
    throw e;
  });
}
