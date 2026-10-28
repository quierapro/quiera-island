/**
 * Synced lyrics. Two sources, in order:
 *
 * 1. NetEase Cloud Music, through the backend: real word timing ("yrc").
 *    Unofficial API (see src-tauri/src/lyrics.rs).
 * 2. LRCLIB (https://lrclib.net, free, no key): line timing only, so each
 *    line is highlighted in two estimated halves.
 *
 * Only the track's title, artist, album and duration are sent.
 */
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import type { MediaState } from "../../ipc/media";
import { trackKey } from "./progress";

export interface LyricWord {
  text: string;
  /** When the word is sung, ms from the start of the track. */
  time: number;
}

export interface LyricLine {
  /** Start of the line, ms from the start of the track. */
  time: number;
  /** Empty for an instrumental gap. */
  text: string;
  /**
   * What turns white in turn: the real words when the source times them,
   * otherwise the line's two halves at estimated times.
   */
  words: LyricWord[];
  /** True when the source gave each word's time; false when estimated. */
  wordSync: boolean;
}

const STAMP = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;
const WORD_STAMP = /<(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)>/g;

function ms(minutes: string, seconds: string): number {
  return Number(minutes) * 60_000 + Math.round(parseFloat(seconds.replace(":", ".")) * 1000);
}

/**
 * How long a line is actually sung. The next line's start is only an upper
 * bound: songs breathe between lines. About 70 ms per character, at least
 * 0.6 s.
 */
export function singingSpan(text: string, gapMs: number): number {
  return Math.max(1, Math.min(gapMs, Math.max(600, text.length * 70)));
}

/**
 * Without word timing, a line is highlighted in two halves: word-by-word
 * guesses drift visibly, halves much less. The cut goes after a comma near
 * the middle when there is one, else at the word boundary nearest the
 * middle; short lines stay whole. The second half starts when the estimated
 * singing reaches it.
 */
export function halfPhrases(text: string, start: number, gapMs: number): LyricWord[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  if (words.length < 4) return [{ text: words.join(" "), time: start }];
  const total = words.join(" ").length;
  let cut = -1;
  let best = Infinity;
  let at = 0;
  for (let i = 0; i < words.length - 1; i++) {
    at += words[i].length + 1;
    const ratio = at / total;
    if (/[,;:]$/.test(words[i]) && ratio > 0.3 && ratio < 0.7) {
      cut = i + 1;
      break;
    }
    const distance = Math.abs(at - total / 2);
    if (distance < best) {
      best = distance;
      cut = i + 1;
    }
  }
  const first = words.slice(0, cut).join(" ");
  const second = words.slice(cut).join(" ");
  const span = singingSpan(text, gapMs);
  return [
    { text: first, time: start },
    { text: second, time: start + Math.round((span * (first.length + 1)) / (total + 1)) },
  ];
}

/** Parses NetEase "yrc": `[start,duration](wordStart,wordDuration,0)word…`, times in ms. */
export function parseYrc(yrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of yrc.split(/\r?\n/)) {
    const head = raw.match(/^\[(\d+),(\d+)\]/);
    if (!head) continue;
    const body = raw.slice(head[0].length);
    const marks = [...body.matchAll(/\((\d+),(\d+),\d+\)/g)];
    const words: LyricWord[] = [];
    marks.forEach((m, i) => {
      const text = body.slice(m.index! + m[0].length, marks[i + 1]?.index ?? body.length).trim();
      if (text) words.push({ text, time: Number(m[1]) });
    });
    const text = words.map((w) => w.text).join(" ");
    if (text) lines.push({ time: Number(head[1]), text, words, wordSync: true });
  }
  return lines.sort((a, b) => a.time - b.time);
}

/** "word" when every line is timed word by word, "phrase" when estimated. */
export function lyricsKind(lines: readonly LyricLine[] | null | undefined): "word" | "phrase" | null {
  if (!lines || lines.length === 0) return null;
  return lines.every((l) => l.wordSync || l.words.length === 0) ? "word" : "phrase";
}

/** Words of an enhanced-LRC line: `<mm:ss.xx>word <mm:ss.xx>word`. */
function stampedWords(body: string, offset: number): LyricWord[] | null {
  const marks = [...body.matchAll(WORD_STAMP)];
  if (marks.length === 0) return null;
  const words: LyricWord[] = [];
  marks.forEach((m, i) => {
    const from = m.index! + m[0].length;
    const to = marks[i + 1]?.index ?? body.length;
    const time = Math.max(0, ms(m[1], m[2]) - offset);
    for (const w of body.slice(from, to).split(/\s+/).filter(Boolean)) words.push({ text: w, time });
  });
  return words;
}

/**
 * Parses LRC text: `[mm:ss.xx] line`, several stamps per line, `[offset:ms]`,
 * and enhanced LRC word stamps when present.
 */
export function parseLrc(lrc: string): LyricLine[] {
  let offset = 0;
  const raw: { time: number; body: string }[] = [];
  for (const line of lrc.split(/\r?\n/)) {
    const off = line.match(/^\s*\[offset:\s*([+-]?\d+)\s*\]/i);
    if (off) {
      offset = Number(off[1]);
      continue;
    }
    const stamps = [...line.matchAll(STAMP)];
    if (stamps.length === 0) continue;
    const body = line.replace(STAMP, "").trim();
    for (const m of stamps) raw.push({ time: ms(m[1], m[2]), body });
  }
  // A positive offset means the lyrics come earlier.
  const sorted = raw.map((r) => ({ ...r, time: Math.max(0, r.time - offset) })).sort((a, b) => a.time - b.time);
  return sorted.map((r, i) => {
    const text = r.body.replace(WORD_STAMP, "").replace(/\s+/g, " ").trim();
    const stamped = stampedWords(r.body, offset);
    const gap = (sorted[i + 1]?.time ?? r.time + 5000) - r.time;
    return {
      time: r.time,
      text,
      words: stamped ?? halfPhrases(text, r.time, gap),
      wordSync: stamped !== null,
    };
  });
}

/** Index of the line being sung at `positionMs`; -1 before the first. */
export function activeLine(lines: readonly LyricLine[], positionMs: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= positionMs) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/** How many words of `line` have been sung at `positionMs`. */
export function wordsSung(line: LyricLine | undefined, positionMs: number): number {
  if (!line) return 0;
  let n = 0;
  while (n < line.words.length && line.words[n].time <= positionMs) n++;
  return n;
}

const NOISE =
  /\s*[([](?:official|lyrics?|audio|video|clip|visuali[sz]er|hd|4k|remaster(?:ed)?|live|explicit|paroles)[^)\]]*[)\]]/gi;

/**
 * What to search for. Browsers report YouTube videos as "Artist - Title
 * (Official Video)" by the channel, so the title is cleaned and split.
 */
export function lyricsQuery(title: string, artist: string): { track: string; artist: string } {
  let track = title.replace(NOISE, "").trim();
  let who = artist.replace(/\s*-\s*topic$/i, "").replace(/vevo$/i, "").trim();
  const dash = track.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (dash) {
    who = dash[1].trim();
    track = dash[2].trim();
  }
  track = track.replace(/\s+[([]?(?:feat\.?|ft\.?)\s.*$/i, "").trim();
  return { track, artist: who };
}

const HEADERS = { "Lrclib-Client": "Quiera (https://github.com/quierapro/quiera-island)" };

interface LrclibTrack {
  duration: number;
  syncedLyrics: string | null;
}

/** NetEase's word-synced lyrics through the backend; null when unavailable. */
async function fetchWordSynced(track: string, artist: string, durationMs: number | null): Promise<LyricLine[] | null> {
  try {
    const yrc = await invoke<string | null>("lyrics_word_synced", { title: track, artist, durationMs });
    const lines = yrc ? parseYrc(yrc) : [];
    return lines.length > 0 ? lines : null;
  } catch {
    return null;
  }
}

async function fetchLyrics(state: MediaState): Promise<LyricLine[] | null> {
  const { track, artist } = lyricsQuery(state.title, state.artist);
  if (!track) return null;
  const wordSynced = await fetchWordSynced(track, artist, state.durationMs);
  if (wordSynced) return wordSynced;
  const seconds = state.durationMs ? Math.round(state.durationMs / 1000) : null;

  const exact = new URLSearchParams({ track_name: track, artist_name: artist });
  if (state.album) exact.set("album_name", state.album);
  if (seconds) exact.set("duration", String(seconds));
  const got = await fetch(`https://lrclib.net/api/get?${exact}`, { headers: HEADERS });
  if (got.ok) {
    const hit = (await got.json()) as LrclibTrack;
    if (hit.syncedLyrics) return parseLrc(hit.syncedLyrics);
  }

  const search = new URLSearchParams({ track_name: track, artist_name: artist });
  const found = await fetch(`https://lrclib.net/api/search?${search}`, { headers: HEADERS });
  if (!found.ok) return null;
  const list = (await found.json()) as LrclibTrack[];
  const close = (t: LrclibTrack) => seconds === null || Math.abs(t.duration - seconds) <= 3;
  const hit = list.find((t) => t.syncedLyrics && close(t));
  return hit?.syncedLyrics ? parseLrc(hit.syncedLyrics) : null;
}

/** Results per track, so going back to a song does not ask again. */
const cache = new Map<string, LyricLine[] | null>();
const pending = new Map<string, Promise<LyricLine[] | null>>();

/** The synced lyrics of the current track: undefined while loading, null if none. */
export function useLyrics(state: MediaState | null | undefined): LyricLine[] | null | undefined {
  const key = state ? trackKey(state) : null;
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!key || !state || cache.has(key)) return;
    let live = true;
    let request = pending.get(key);
    if (!request) {
      request = fetchLyrics(state).catch(() => null);
      pending.set(key, request);
    }
    request.then((lines) => {
      cache.set(key, lines && lines.length > 0 ? lines : null);
      pending.delete(key);
      if (live) rerender((n) => n + 1);
    });
    return () => {
      live = false;
    };
    // Only a new track triggers a request; position updates do not.
  }, [key]);

  if (!key) return null;
  return cache.has(key) ? cache.get(key) : undefined;
}

/**
 * The font size that fits `width`: lines stay on one row and shrink when
 * they are long, down to `min` (then they end with an ellipsis). Rounded
 * down to half pixels.
 */
export function fitFontSize(naturalWidth: number, width: number, size: number, min: number): number {
  if (naturalWidth <= width || naturalWidth === 0) return size;
  return Math.max(min, Math.floor(((size * width) / naturalWidth) * 2) / 2);
}
