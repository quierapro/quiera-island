/** Whether the island is welcoming the user (first launch), shared by its views. */
import { useSyncExternalStore } from "react";
import { welcomeDone, welcomeNeeded } from "../../ipc/welcome";

let active = false;
let started = false;
const listeners = new Set<() => void>();

function publish(next: boolean) {
  active = next;
  for (const l of listeners) l();
}

export function startWelcome(): void {
  if (started) return;
  started = true;
  welcomeNeeded()
    .then(publish)
    .catch(() => {});
}

/** The welcome ended, finished or skipped. */
export function endWelcome(): void {
  publish(false);
  welcomeDone().catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWelcome(): boolean {
  return useSyncExternalStore(subscribe, () => active);
}
