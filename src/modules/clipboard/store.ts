/** One subscription to the clipboard history, shared by every view. */
import { useSyncExternalStore } from "react";
import { getClipboard, onClipboard, type ClipItem } from "../../ipc/clipboard";

let items: ClipItem[] = [];
const listeners = new Set<() => void>();
let started = false;

function publish(next: ClipItem[]) {
  items = next;
  for (const l of listeners) l();
}

export function startClipboard(): void {
  if (started) return;
  started = true;
  onClipboard(publish)
    .then(() => getClipboard())
    .then(publish)
    .catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useClipboard(): ClipItem[] {
  return useSyncExternalStore(subscribe, () => items);
}
