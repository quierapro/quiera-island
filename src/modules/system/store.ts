/**
 * The latest system peek, and the hook that announces each one on the
 * island. A peek of the same kind replaces the one on screen (holding the
 * volume key updates the bar instead of stacking peeks).
 */
import { useEffect, useSyncExternalStore } from "react";
import { onSystemPeek, type SystemPeek } from "../../ipc/peeks";
import type { IslandController } from "../../machine/controller";

export const SYSTEM_PEEK_PREFIX = "system:";
const NOTIFICATION_HOLD_MS = 5000;

let current: SystemPeek | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSystemPeek(): SystemPeek | null {
  return useSyncExternalStore(subscribe, () => current);
}

export function useSystemPeeks(controller: IslandController): void {
  useEffect(() => {
    let live = true;
    let unlisten: (() => void) | undefined;
    onSystemPeek((peek) => {
      current = peek;
      for (const l of listeners) l();
      // A notification has more to read.
      controller.showPeek(`${SYSTEM_PEEK_PREFIX}${peek.kind}`, peek.kind === "notification" ? NOTIFICATION_HOLD_MS : undefined);
    })
      .then((stop) => {
        if (live) unlisten = stop;
        else stop();
      })
      .catch(() => {});
    return () => {
      live = false;
      unlisten?.();
    };
  }, [controller]);
}
