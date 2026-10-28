// SPDX-License-Identifier: GPL-3.0-only
//
// Parts of the player are adapted from Bloom's CompactMediaPlayer and media
// controls (src/CompactMediaPlayer.tsx and src/App.tsx, commit fa32e83,
// https://github.com/SehajveerSingh2005/bloom), Copyright © 2026 Sehajveer
// Singh, GPL-3.0-only: the cover flip between tracks, the skip buttons' push
// animation and the seekable progress bar.
// Changes: driven by Quiera's media store and module sizes; own glyphs
// instead of SF Symbols; commands sent at once instead of after the skip
// animation; progress drawn per frame with a transform; new layout with
// synced lyrics, shuffle and repeat; accent colour from the cover.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useAnimate,
  useMotionValue,
  useMotionValueEvent,
  type MotionValue,
} from "motion/react";
import * as media from "../../ipc/media";
import type { MediaState } from "../../ipc/media";
import type { Size } from "../../island/geometry";
import type { Surface } from "../../machine/island-machine";
import { NoteIcon, PauseIcon, PlayIcon, RepeatIcon, ShuffleIcon, SkipIcon } from "./icons";
import { activeLine, fitFontSize, useLyrics, wordsSung, type LyricLine } from "./lyrics";
import { Marquee } from "./Marquee";
import { formatRemaining, formatTime, positionAt, trackKey } from "./progress";
import { setOptimisticPlaying, useMedia } from "./store";
import "./media.css";

const ignore = () => {};

/** Sizes of the media views; lyrics make room for themselves. */
export function mediaSize(
  surface: Surface,
  state: MediaState | null | undefined,
  lyrics: "word" | "phrase" | null,
): Size | undefined {
  const hasLyrics = lyrics !== null;
  // One real word at a time needs little room; an estimated half-phrase more.
  if (surface === "activity") {
    if (lyrics === "word") return [236, 34, 17];
    if (lyrics === "phrase") return [320, 34, 17];
    return undefined;
  }
  if (surface === "expanded") {
    if (!state) return undefined;
    return hasLyrics ? [650, 176, 30] : [400, 176, 30];
  }
  return undefined;
}

/**
 * Playback position in ms as a motion value, advanced every frame while
 * playing (no React render per frame).
 */
function usePlaybackClock(state: MediaState): MotionValue<number> {
  const clock = useMotionValue(positionAt(state, Date.now()) ?? 0);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      clock.set(positionAt(state, Date.now()) ?? 0);
      if (state.playing) frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [state, clock]);
  return clock;
}

/** Cover art with Bloom's flip between tracks; a note when there is none. */
function Art({ url, size, radius }: { url: string | null; size: number; radius: number }) {
  return (
    <div className="media-art" style={{ width: size, height: size, borderRadius: radius }}>
      <AnimatePresence mode="wait" initial={false}>
        {url ? (
          <motion.img
            key={url}
            src={url}
            alt=""
            draggable={false}
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          />
        ) : (
          <motion.div
            key="none"
            className="media-art-none"
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <NoteIcon size={Math.round(size * 0.45)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Activity bars. Decorative for now: they move with playback, not with the sound. */
function Bars({ playing, height = 12 }: { playing: boolean; height?: number }) {
  return (
    <span className={`media-bars ${playing ? "media-bars--playing" : ""}`} style={{ height }} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function accentStyle(accent: string): CSSProperties {
  return { "--accent": accent } as CSSProperties;
}

/**
 * Follows the line and the number of words sung, rendering only when one of
 * them changes (not every frame).
 */
function useSungWords(lines: LyricLine[], clock: MotionValue<number>): { index: number; sung: number } {
  const initial = () => {
    const index = activeLine(lines, clock.get());
    return { index, sung: wordsSung(lines[index], clock.get()) };
  };
  const [at, setAt] = useState(initial);
  const ref = useRef(at);
  useMotionValueEvent(clock, "change", (pos) => {
    const index = activeLine(lines, pos);
    const sung = wordsSung(lines[index], pos);
    if (index !== ref.current.index || sung !== ref.current.sung) {
      ref.current = { index, sung };
      setAt(ref.current);
    }
  });
  return at;
}

/** The word being sung, one after another (compact pill). */
function CurrentWord({ lines, state }: { lines: LyricLine[]; state: MediaState }) {
  const clock = usePlaybackClock(state);
  const { index, sung } = useSungWords(lines, clock);
  const line = lines[index];
  const word = line && sung > 0 ? line.words[sung - 1].text : line && !line.text ? "♪" : "";
  return (
    <span className="media-word">
      <AnimatePresence initial={false} mode="popLayout">
        {word && (
          <motion.span
            key={`${index}:${sung}`}
            className="media-word-text"
            initial={{ y: 7, opacity: 0, filter: "blur(2px)" }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            exit={{ y: -7, opacity: 0, filter: "blur(2px)" }}
            transition={{ duration: 0.18, ease: [0.33, 1, 0.68, 1] }}
          >
            {word}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** Compact pill while music plays: cover, the word being sung, bars. */
export function MediaActivity() {
  const { state, accent } = useMedia();
  const lines = useLyrics(state);
  return (
    <div className="media-activity" style={accentStyle(accent)}>
      <Art url={state?.artwork ?? null} size={20} radius={6} />
      {state && lines && <CurrentWord key={trackKey(state)} lines={lines} state={state} />}
      <Bars playing={state?.playing ?? false} />
    </div>
  );
}
/** A new track: cover, title and artist for a moment. */
export function MediaPeek() {
  const { state, accent } = useMedia();
  return (
    <div className="media-peek" style={accentStyle(accent)}>
      <Art url={state?.artwork ?? null} size={28} radius={8} />
      <div className="media-text">
        <Marquee text={state?.title || "Lecture en cours"} className="media-title" />
        <span className="media-artist">{state?.artist}</span>
      </div>
      <Bars playing={state?.playing ?? false} />
    </div>
  );
}

/** Previous / next with Bloom's push animation: the glyph slides out, a twin slides in. */
function SkipButton({ back, disabled, onPress }: { back: boolean; disabled: boolean; onPress(): void }) {
  const [scope, animateIn] = useAnimate();
  const dir = back ? -1 : 1;
  const press = () => {
    if (disabled) return;
    onPress();
    const ease = [0.4, 0, 0.2, 1] as const;
    animateIn(".skip-front", { x: [0, 26 * dir] }, { duration: 0.18, ease });
    animateIn(".skip-back", { x: [-26 * dir, 0] }, { duration: 0.18, ease });
  };
  return (
    <motion.button
      className="media-btn"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        press();
      }}
      whileTap={disabled ? undefined : { scale: 0.9 }}
      aria-label={back ? "Piste précédente" : "Piste suivante"}
    >
      <span ref={scope} className="skip-wrap">
        <span className="skip-layer skip-back" style={{ transform: `translateX(${-26 * dir}px)` }}>
          <SkipIcon size={22} back={back} />
        </span>
        <span className="skip-layer skip-front">
          <SkipIcon size={22} back={back} />
        </span>
      </span>
    </motion.button>
  );
}

function PlayButton({ state }: { state: MediaState }) {
  return (
    <motion.button
      className="media-btn media-btn--play"
      disabled={!state.canPlayPause}
      onClick={(e) => {
        e.stopPropagation();
        setOptimisticPlaying(!state.playing);
        media.playPause().catch(ignore);
      }}
      whileTap={{ scale: 0.92 }}
      aria-label={state.playing ? "Pause" : "Lecture"}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state.playing ? "pause" : "play"}
          className="media-btn-glyph"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.12 }}
        >
          {state.playing ? <PauseIcon size={28} /> : <PlayIcon size={28} />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

const NEXT_REPEAT: Record<media.RepeatMode, media.RepeatMode> = { none: "list", list: "track", track: "none" };

function ShuffleButton({ state }: { state: MediaState }) {
  const on = state.shuffle === true;
  return (
    <motion.button
      className={`media-btn media-btn--small ${on ? "media-btn--on" : ""}`}
      disabled={!state.canShuffle || state.shuffle === null}
      onClick={(e) => {
        e.stopPropagation();
        media.setShuffle(!on).catch(ignore);
      }}
      whileTap={{ scale: 0.9 }}
      aria-label="Aléatoire"
      aria-pressed={on}
    >
      <ShuffleIcon size={18} />
    </motion.button>
  );
}

function RepeatButton({ state }: { state: MediaState }) {
  const mode = state.repeat ?? "none";
  return (
    <motion.button
      className={`media-btn media-btn--small ${mode !== "none" ? "media-btn--on" : ""}`}
      disabled={!state.canRepeat || state.repeat === null}
      onClick={(e) => {
        e.stopPropagation();
        media.setRepeat(NEXT_REPEAT[mode]).catch(ignore);
      }}
      whileTap={{ scale: 0.9 }}
      aria-label="Répétition"
    >
      <RepeatIcon size={18} one={mode === "track"} />
    </motion.button>
  );
}

/**
 * Elapsed time, bar and time left. The bar follows the clock with a
 * transform (no layout); the times re-render only when a second changes.
 */
function Progress({ state, clock }: { state: MediaState; clock: MotionValue<number> }) {
  const duration = state.durationMs ?? 0;
  const [dragging, setDragging] = useState<number | null>(null);
  const [second, setSecond] = useState(() => Math.floor(clock.get() / 1000));
  const shown = dragging ?? second * 1000;
  const fraction = useMotionValue(duration > 0 ? clock.get() / duration : 0);
  useMotionValueEvent(clock, "change", (pos) => {
    fraction.set(duration > 0 ? pos / duration : 0);
    const s = Math.floor(pos / 1000);
    if (s !== second) setSecond(s);
  });

  const commit = () => {
    if (dragging === null) return;
    media.seek(dragging).catch(ignore);
    setDragging(null);
  };

  return (
    <div className="media-progress">
      <span className="media-time">{formatTime(shown)}</span>
      <div className="media-track">
        <motion.div className="media-fill" style={{ scaleX: dragging !== null ? dragging / duration : fraction }} />
        {state.canSeek && (
          <input
            type="range"
            className="media-seek"
            min={0}
            max={duration}
            step={500}
            value={shown}
            onPointerDown={(e) => {
              e.stopPropagation();
              setDragging(clock.get());
            }}
            onChange={(e) => setDragging(Number(e.target.value))}
            onPointerUp={commit}
            onKeyUp={commit}
            onClick={(e) => e.stopPropagation()}
            aria-label="Position"
          />
        )}
      </div>
      <span className="media-time media-time--end">{formatRemaining(shown, duration)}</span>
    </div>
  );
}

/** Height of one lyrics row and of the window (five rows). */
const ROW = 27;
const LYRICS_HEIGHT = ROW * 5;
/** Rows above the current line: the one sung just before stays in view. */
const ROWS_ABOVE = 1;
const LYRIC_FONT = { size: 15, min: 10, weight: 800 };

let measureCanvas: HTMLCanvasElement | null = null;

/** Each line's font size for a column `width` px wide. */
function useFittedSizes(lines: LyricLine[], width: number): number[] {
  const [sizes, setSizes] = useState<number[]>([]);
  useEffect(() => {
    if (width <= 0) return;
    measureCanvas ??= document.createElement("canvas");
    const ctx = measureCanvas.getContext("2d");
    if (!ctx) return;
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-display");
    ctx.font = `${LYRIC_FONT.weight} ${LYRIC_FONT.size}px ${family}`;
    setSizes(
      lines.map((l) => fitFontSize(ctx.measureText(l.text || "♪").width, width, LYRIC_FONT.size, LYRIC_FONT.min)),
    );
  }, [lines, width]);
  return sizes;
}

/**
 * Synced lyrics, one phrase per row. In the current line each word turns
 * white when it is sung; the other lines are dimmer and softer the further
 * they are. Clicking a line jumps there.
 */
function Lyrics({ lines, clock, canSeek }: { lines: LyricLine[]; clock: MotionValue<number>; canSeek: boolean }) {
  const { index, sung } = useSungWords(lines, clock);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const sizes = useFittedSizes(lines, width);
  const y = useMotionValue((ROWS_ABOVE - Math.max(index, 0)) * ROW);
  const first = useRef(true);

  useEffect(() => {
    if (box.current) setWidth(box.current.clientWidth);
  }, []);

  useEffect(() => {
    const target = (ROWS_ABOVE - Math.max(index, 0)) * ROW;
    if (first.current) {
      first.current = false;
      y.set(target);
      return;
    }
    const controls = animate(y, target, { type: "spring", stiffness: 240, damping: 30 });
    return () => controls.stop();
  }, [index, y]);

  return (
    <div ref={box} className="lyrics" style={{ height: LYRICS_HEIGHT }}>
      <motion.div className="lyrics-track" style={{ y }}>
        {lines.map((line, i) => (
          <div
            key={i}
            className={`lyric ${canSeek ? "lyric--seek" : ""}`}
            data-distance={Math.min(3, Math.abs(i - index))}
            style={{ height: ROW, fontSize: sizes[i] ?? LYRIC_FONT.size }}
            onClick={(e) => {
              e.stopPropagation();
              if (canSeek) media.seek(line.time).catch(ignore);
            }}
          >
            {i === index && line.words.length > 0
              ? line.words.map((w, k) => (
                  <span key={k} className={`lyric-word ${k < sung ? "lyric-word--sung" : ""}`}>
                    {w.text}{" "}
                  </span>
                ))
              : line.text || "♪"}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

/** The open panel: player on the left, synced lyrics on the right. */
export function MediaExpanded() {
  const { state, accent } = useMedia();
  if (!state) return null;
  return <Player state={state} accent={accent} />;
}

function Player({ state, accent }: { state: MediaState; accent: string }) {
  const clock = usePlaybackClock(state);
  const lines = useLyrics(state);
  return (
    <div className="media-expanded" style={accentStyle(accent)}>
      <div className="media-player">
        <div className="media-head">
          <Art url={state.artwork} size={60} radius={14} />
          <div className="media-text">
            <Marquee text={state.title || "Titre inconnu"} className="media-title media-title--lg" />
            <span className="media-artist">{state.artist}</span>
          </div>
        </div>
        {state.durationMs !== null ? <Progress state={state} clock={clock} /> : <div className="media-progress" />}
        <div className="media-controls">
          <ShuffleButton state={state} />
          <SkipButton back disabled={!state.canPrevious} onPress={() => media.previous().catch(ignore)} />
          <PlayButton state={state} />
          <SkipButton back={false} disabled={!state.canNext} onPress={() => media.next().catch(ignore)} />
          <RepeatButton state={state} />
        </div>
      </div>
      {lines && <Lyrics key={trackKey(state)} lines={lines} clock={clock} canSeek={state.canSeek} />}
    </div>
  );
}
