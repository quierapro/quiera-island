/**
 * The quick controls' state, read from the system on demand: when the
 * panel opens, then regularly while the Controls tab shows. Apps keep the
 * order they first appeared in, so the list does not reshuffle under the
 * pointer each time it is read.
 */
import { useEffect, useSyncExternalStore } from "react";
import { getControls, type Controls } from "../../ipc/controls";

const POLL_MS = 1500;

let state: Controls | null = null;
/** Whether the output list is unfolded (the panel makes room for it). */
let outputsOpen = false;
const listeners = new Set<() => void>();

function publish() {
  for (const l of listeners) l();
}

/** `next`'s apps in `previous`'s order, newcomers after. */
export function keepOrder(previous: Controls["apps"], next: Controls["apps"]): Controls["apps"] {
  const rank = new Map(previous.map((a, i) => [a.key, i]));
  return [...next].sort((a, b) => (rank.get(a.key) ?? Infinity) - (rank.get(b.key) ?? Infinity));
}

export function refreshControls(): void {
  getControls()
    .then((next) => {
      state = { ...next, apps: state ? keepOrder(state.apps, next.apps) : next.apps };
      publish();
    })
    .catch(() => {});
}

export function setOutputsOpen(open: boolean): void {
  outputsOpen = open;
  publish();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useControls(): Controls | null {
  return useSyncExternalStore(subscribe, () => state);
}

export function useOutputsOpen(): boolean {
  return useSyncExternalStore(subscribe, () => outputsOpen);
}

/** Reads once when `open` turns on, and keeps reading while `polling`. */
export function useControlsRefresh(open: boolean, polling: boolean): void {
  useEffect(() => {
    if (open) refreshControls();
    else setOutputsOpen(false);
  }, [open]);
  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(refreshControls, POLL_MS);
    return () => clearInterval(timer);
  }, [polling]);
}
