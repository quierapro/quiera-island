/**
 * Turns raw pointer input and timers into machine events, so the machine
 * itself stays free of time:
 *
 * - hover intent: the pointer must rest on the island before it counts, so a
 *   pass on the way to a tab bar does not wake it;
 * - hover grace: a short exit is forgiven, so the island does not flicker
 *   when the pointer grazes its edge;
 * - open on hover: resting a little longer opens the panel, no click needed;
 * - peek duration.
 */
import type { IslandEvent } from "./island-machine";

export interface Timing {
  hoverIntentMs: number;
  /** After hovering starts, the panel opens this much later; null: click only. */
  hoverOpenMs: number | null;
  hoverGraceMs: number;
  peekHoldMs: number;
  /** After files are dropped, the panel shows them this long before closing. */
  dropHoldMs: number;
}

export const TIMING: Timing = {
  hoverIntentMs: 60,
  // 0: the panel opens with the hover itself, in one motion (no "hovered"
  // step in between).
  hoverOpenMs: 0,
  hoverGraceMs: 350,
  peekHoldMs: 2200,
  dropHoldMs: 2000,
};

export interface IslandController {
  pointerEnter(): void;
  pointerLeave(): void;
  press(): void;
  showPeek(id: string): void;
  /** Files dragged from another app entered, left, or were dropped. */
  dragEnter(): void;
  dragLeave(): void;
  dragDrop(): void;
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
  let open: Timer | null = null;
  let grace: Timer | null = null;
  let peek: Timer | null = null;
  let dropHold: Timer | null = null;

  const clear = (t: Timer | null) => {
    if (t !== null) clearTimeout(t);
    return null;
  };

  const scheduleOpen = () => {
    if (timing.hoverOpenMs === null || open !== null) return;
    if (timing.hoverOpenMs === 0) {
      // Same tick as hover.start: React renders both at once.
      dispatch({ type: "press" });
      return;
    }
    open = setTimeout(() => {
      open = null;
      dispatch({ type: "press" });
    }, timing.hoverOpenMs);
  };

  const startHover = () => {
    intent = clear(intent);
    if (hovered) return;
    hovered = true;
    dispatch({ type: "hover.start" });
    scheduleOpen();
  };

  return {
    pointerEnter() {
      grace = clear(grace);
      // The pointer takes over from the post-drop timer.
      dropHold = clear(dropHold);
      if (hovered) {
        // Back within the grace period: carry on towards opening.
        scheduleOpen();
        return;
      }
      if (intent !== null) return;
      intent = setTimeout(startHover, timing.hoverIntentMs);
    },

    pointerLeave() {
      intent = clear(intent);
      open = clear(open);
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
      open = clear(open);
      dispatch({ type: "press" });
    },

    dragEnter() {
      dropHold = clear(dropHold);
      grace = clear(grace);
      dispatch({ type: "drag.enter" });
    },

    dragLeave() {
      dispatch({ type: "drag.leave" });
    },

    dragDrop() {
      dispatch({ type: "drag.drop" });
      // A drag produces no pointer events: unless the pointer shows up on
      // the island, close once the new items have been seen.
      dropHold = clear(dropHold);
      dropHold = setTimeout(() => {
        dropHold = null;
        if (!hovered) dispatch({ type: "close" });
      }, timing.dropHoldMs);
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
      open = clear(open);
      grace = clear(grace);
      hovered = false;
    },

    dispose() {
      intent = clear(intent);
      open = clear(open);
      grace = clear(grace);
      peek = clear(peek);
      dropHold = clear(dropHold);
    },
  };
}
