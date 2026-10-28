/**
 * Turns raw pointer input and timers into machine events, so the machine
 * itself stays free of time:
 *
 * - hover intent: the pointer must rest on the island before it counts, so a
 *   pass on the way to a tab bar does not wake it;
 * - hover grace: a short exit is forgiven, so the island does not flicker
 *   when the pointer grazes its edge;
 * - peek duration.
 */
import type { IslandEvent } from "./island-machine";

export interface Timing {
  hoverIntentMs: number;
  hoverGraceMs: number;
  peekHoldMs: number;
}

export const TIMING: Timing = {
  hoverIntentMs: 120,
  hoverGraceMs: 350,
  peekHoldMs: 2200,
};

export interface IslandController {
  pointerEnter(): void;
  pointerLeave(): void;
  press(): void;
  showPeek(id: string): void;
  /** Forget the pointer, e.g. once the island is hidden and cannot see it leave. */
  resetPointer(): void;
  dispose(): void;
}

type Timer = ReturnType<typeof setTimeout>;

export function createIslandController(
  dispatch: (event: IslandEvent) => void,
  timing: Timing = TIMING,
): IslandController {
  let hovered = false;
  let intent: Timer | null = null;
  let grace: Timer | null = null;
  let peek: Timer | null = null;

  const clear = (t: Timer | null) => {
    if (t !== null) clearTimeout(t);
    return null;
  };

  const startHover = () => {
    intent = clear(intent);
    if (hovered) return;
    hovered = true;
    dispatch({ type: "hover.start" });
  };

  return {
    pointerEnter() {
      grace = clear(grace);
      if (hovered || intent !== null) return;
      intent = setTimeout(startHover, timing.hoverIntentMs);
    },

    pointerLeave() {
      intent = clear(intent);
      if (!hovered || grace !== null) return;
      grace = setTimeout(() => {
        grace = null;
        hovered = false;
        dispatch({ type: "hover.end" });
      }, timing.hoverGraceMs);
    },

    press() {
      // A click is the clearest intent there is: no need to wait for it.
      grace = clear(grace);
      startHover();
      dispatch({ type: "press" });
    },

    showPeek(id) {
      peek = clear(peek);
      dispatch({ type: "peek.show", id });
      peek = setTimeout(() => {
        peek = null;
        dispatch({ type: "peek.expire", id });
      }, timing.peekHoldMs);
    },

    resetPointer() {
      intent = clear(intent);
      grace = clear(grace);
      hovered = false;
    },

    dispose() {
      intent = clear(intent);
      grace = clear(grace);
      peek = clear(peek);
    },
  };
}
