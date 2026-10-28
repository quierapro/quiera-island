import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** Mirrors `MediaState` in `src-tauri/src/media.rs`. */
export interface MediaState {
  /** The app publishing the session (e.g. "Spotify.exe"). */
  appId: string;
  title: string;
  artist: string;
  album: string;
  playing: boolean;
  positionMs: number | null;
  durationMs: number | null;
  /** When `positionMs` was true, in Unix ms. */
  positionAt: number;
  canSeek: boolean;
  canPrevious: boolean;
  canNext: boolean;
  canPlayPause: boolean;
  /** null when the app does not report it. */
  shuffle: boolean | null;
  repeat: RepeatMode | null;
  canShuffle: boolean;
  canRepeat: boolean;
  /** Cover art URL, or null when the app provides none. */
  artwork: string | null;
}

export type RepeatMode = "none" | "track" | "list";

export function getMedia(): Promise<MediaState | null> {
  return invoke<MediaState | null>("get_media");
}

export function onMedia(callback: (state: MediaState | null) => void): Promise<UnlistenFn> {
  return listen<MediaState | null>("media://state", (event) => callback(event.payload));
}

export const playPause = () => invoke<void>("media_play_pause");
export const next = () => invoke<void>("media_next");
export const previous = () => invoke<void>("media_previous");
export const seek = (positionMs: number) => invoke<void>("media_seek", { positionMs: Math.round(positionMs) });
export const setShuffle = (active: boolean) => invoke<void>("media_set_shuffle", { active });
export const setRepeat = (mode: RepeatMode) => invoke<void>("media_set_repeat", { mode });
