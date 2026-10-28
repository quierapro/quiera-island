/**
 * Every spring and duration of the shell, in one place. Values start from
 * Bloom's (GPL-3.0) and follow one rule shared with Boring Notch and
 * Notchify: open with a little bounce, close calmly without overshoot.
 */

export interface Spring {
  type: "spring";
  stiffness: number;
  damping: number;
  mass?: number;
  restDelta?: number;
}

const spring = (stiffness: number, damping: number, mass?: number): Spring => ({
  type: "spring",
  stiffness,
  damping,
  ...(mass === undefined ? {} : { mass }),
  restDelta: 0.01,
});

export const SPRINGS = {
  widthOpen: spring(400, 31),
  widthClose: spring(400, 40),
  heightOpen: spring(450, 29),
  heightClose: spring(450, 40),
  radius: spring(1000, 40),
  y: spring(550, 45, 0.8),
} as const;

/** Durations in seconds. */
export const DURATIONS = {
  /** The flares fading in when the birth bubble meets the edge. */
  flares: 0.3,
  fill: 0.3,
  contentIn: 0.22,
  contentInDelay: 0.06,
  contentOut: 0.09,
} as const;

/** The birth bubble meets the screen edge this long after it starts rising. */
export const BIRTH_IMPACT_MS = 240;

/** How long a shrunk-away region is kept so the animation is not clipped. */
export const REGION_HOLD_MS = 700;

/**
 * The same spring played `factor` times slower: stiffness scales with the
 * square of time, damping linearly (mass unchanged).
 */
export function slowed(s: Spring, factor: number): Spring {
  if (factor === 1) return s;
  return { ...s, stiffness: s.stiffness / (factor * factor), damping: s.damping / factor };
}
