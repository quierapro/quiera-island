/** One subscription to the shelf's items, shared by every view. */
import { useSyncExternalStore } from "react";
import { getShelf, onShelf, type ShelfItem } from "../../ipc/shelf";

let items: ShelfItem[] = [];
const listeners = new Set<() => void>();
let started = false;

function publish(next: ShelfItem[]) {
  items = next;
  for (const l of listeners) l();
}

export function startShelf(): void {
  if (started) return;
  started = true;
  onShelf(publish)
    .then(() => getShelf())
    .then(publish)
    .catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useShelf(): ShelfItem[] {
  return useSyncExternalStore(subscribe, () => items);
}
