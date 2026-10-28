/** One subscription to the notifications, shared by every view. */
import { useSyncExternalStore } from "react";
import { getNotifications, onNotifications, type NotificationItem } from "../../ipc/notifications";

let items: NotificationItem[] = [];
const listeners = new Set<() => void>();
let started = false;

function publish(next: NotificationItem[]) {
  items = next;
  for (const l of listeners) l();
}

export function startNotifications(): void {
  if (started) return;
  started = true;
  onNotifications(publish)
    .then(() => getNotifications())
    .then(publish)
    .catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useNotifications(): NotificationItem[] {
  return useSyncExternalStore(subscribe, () => items);
}
