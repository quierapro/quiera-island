/**
 * One subscription to the backend's media state, shared by every view.
 * Holds the accent colour of the current cover and an optimistic play
 * state, so the play button answers before the app confirms.
 */
import { useSyncExternalStore } from "react";
import { getMedia, onMedia, type MediaState } from "../../ipc/media";
import { extractAccent, NEUTRAL_ACCENT } from "./accent";

export interface MediaSnapshot {
  /** undefined until the backend has answered once. */
  state: MediaState | null | undefined;
  accent: string;
}

let snapshot: MediaSnapshot = { state: undefined, accent: NEUTRAL_ACCENT };
const listeners = new Set<() => void>();
let started = false;
let accentFor: string | null = null;

function publish(next: MediaSnapshot) {
  snapshot = next;
  for (const l of listeners) l();
}

function receive(state: MediaState | null) {
  publish({ ...snapshot, state });
  const art = state?.artwork ?? null;
  if (art === accentFor) return;
  accentFor = art;
  if (!art) {
    publish({ ...snapshot, accent: NEUTRAL_ACCENT });
    return;
  }
  void extractAccent(art).then((accent) => {
    if (accentFor === art) publish({ ...snapshot, accent });
  });
}

/** Starts listening; later calls do nothing. */
export function startMedia(): void {
  if (started) return;
  started = true;
  onMedia(receive)
    .then(() => getMedia())
    .then((state) => {
      // An event may already have arrived; it is newer than this answer.
      if (snapshot.state === undefined) receive(state);
    })
    .catch(() => receive(null));
}

/** Flips the play state at once; the next backend state confirms or corrects it. */
export function setOptimisticPlaying(playing: boolean): void {
  if (!snapshot.state) return;
  publish({ ...snapshot, state: { ...snapshot.state, playing } });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMedia(): MediaSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot);
}
