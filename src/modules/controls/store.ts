/**
 * The quick controls' state, read from the system on demand: when the
 * panel opens, then regularly while the Controls tab shows.
 */
import { useEffect, useSyncExternalStore } from "react";
import { getControls, type Controls } from "../../ipc/controls";

const POLL_MS = 1500;

let state: Controls | null = null;
const listeners = new Set<() => void>();

export function refreshControls(): void {
  getControls()
    .then((next) => {
      state = next;
      for (const l of listeners) l();
    })
    .catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useControls(): Controls | null {
  return useSyncExternalStore(subscribe, () => state);
}

/** Reads once when `open` turns on, and keeps reading while `polling`. */
export function useControlsRefresh(open: boolean, polling: boolean): void {
  useEffect(() => {
    if (open) refreshControls();
  }, [open]);
  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(refreshControls, POLL_MS);
    return () => clearInterval(timer);
  }, [polling]);
}
