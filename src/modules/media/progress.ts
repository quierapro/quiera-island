import type { MediaState } from "../../ipc/media";

type Timeline = Pick<MediaState, "positionMs" | "durationMs" | "positionAt" | "playing">;

/**
 * Where playback is at `now`: apps report the position only now and then,
 * so it is extrapolated from the last report while playing. Null when the
 * app publishes no timeline.
 */
export function positionAt(t: Timeline, now: number): number | null {
  if (t.positionMs === null) return null;
  const elapsed = t.playing && t.positionAt > 0 ? Math.max(0, now - t.positionAt) : 0;
  const position = t.positionMs + elapsed;
  return t.durationMs === null ? position : Math.min(position, t.durationMs);
}

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function formatRemaining(positionMs: number, durationMs: number): string {
  return `-${formatTime(Math.max(0, durationMs - positionMs))}`;
}

/** Identifies a track, to notice when a new one starts. Null without metadata. */
export function trackKey(s: MediaState | null): string | null {
  if (!s || (!s.title && !s.artist)) return null;
  return `${s.appId}\u0000${s.title}\u0000${s.artist}`;
}

export interface MediaDecision {
  /** Show the live music activity. */
  live: boolean;
  /** Announce the track with a peek. */
  peek: boolean;
}

/**
 * What the island should do when the media state changes. `prev` is
 * undefined for the first state after startup: no peek for a track that was
 * already playing.
 */
export function mediaDecision(prev: MediaState | null | undefined, next: MediaState | null): MediaDecision {
  const key = trackKey(next);
  const live = key !== null && next!.playing;
  const peek = prev !== undefined && live && key !== trackKey(prev);
  return { live, peek };
}
