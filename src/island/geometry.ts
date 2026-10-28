/**
 * The shape the shell springs toward for each state. Sizes come from
 * docs/02-decisions-design-fonctionnalites.md §3.4.
 */
import type { Surface } from "../machine/island-machine";
import { FLARE, silhouetteWidth } from "./shell";

export interface ShellTarget {
  width: number;
  height: number;
  topRadius: number;
  bottomRadius: number;
  /** 0 → 1: the flares joining the body to the screen edge. */
  flares: number;
  /** Opacity of the black fill. */
  fill: number;
  /** Vertical offset: negative is above the screen edge (hidden). */
  y: number;
}

/** Opaque black: true OLED black, and the content reads the same on any wallpaper. */
const COMPACT_FILL = 1;
const EXPANDED_FILL = 1;

export type Size = [width: number, height: number, radius: number];

const SIZES: Record<Exclude<Surface, "hidden">, Size> = {
  idle: [124, 34, 17],
  activity: [200, 34, 17],
  peek: [340, 46, 22],
  expanded: [600, 196, 28],
};

/** Hovering a compact island grows it slightly: "I see you". */
const HOVER_GROWTH = { width: 10, height: 2, radius: 1 };

/** `size` lets the module on screen ask for its own dimensions. */
export function targetFor(surface: Surface, hovered: boolean, size?: Size): ShellTarget {
  if (surface === "hidden") {
    const [width, height, radius] = SIZES.idle;
    return { width, height, topRadius: 0, bottomRadius: radius, flares: 1, fill: COMPACT_FILL, y: -(height + 4) };
  }
  const [width, height, radius] = size ?? SIZES[surface];
  const grow = hovered && surface !== "expanded";
  return {
    width: width + (grow ? HOVER_GROWTH.width : 0),
    height: height + (grow ? HOVER_GROWTH.height : 0),
    topRadius: 0,
    bottomRadius: radius + (grow ? HOVER_GROWTH.radius : 0),
    flares: 1,
    fill: surface === "expanded" ? EXPANDED_FILL : COMPACT_FILL,
    y: 0,
  };
}

/** The birth bubble: a floating circle below the edge, before it meets it. */
export const BIRTH: ShellTarget = {
  width: 34,
  height: 34,
  topRadius: 17,
  bottomRadius: 17,
  flares: 0,
  fill: COMPACT_FILL,
  y: 56,
};

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The window area a target needs, in CSS pixels: from the screen edge down to
 * its bottom (so a shape travelling up from below stays inside), centered in
 * the window, padded for antialiasing. Null when it is entirely off screen.
 */
export function targetBox(t: ShellTarget, windowWidth: number, pad = 2): Box | null {
  const bottom = t.y + t.height;
  if (bottom <= 0) return null;
  const width = silhouetteWidth(t.width) + 2 * pad;
  return {
    x: Math.floor((windowWidth - width) / 2),
    y: 0,
    width: Math.ceil(width),
    height: Math.ceil(bottom + pad),
  };
}

export { FLARE };
