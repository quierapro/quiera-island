/**
 * The island's state machine: a pure `(state, event) → state` function.
 *
 * It decides *what* the island shows, never *how* it moves: the shell derives
 * a target shape from the state and springs toward it, so a transition is not
 * a state and can be interrupted at any time.
 *
 * Timing (hover intent, grace, peek duration) lives in `controller.ts`, which
 * turns pointer input and timers into the events below.
 */
import { primaryActivity, type Activity } from "./arbiter";

export type Surface = "hidden" | "idle" | "activity" | "peek" | "expanded";

export interface PeekState {
  id: string;
  /** Its time is up, but the pointer is on the island: it leaves with the pointer. */
  expired: boolean;
}

export interface IslandState {
  visible: boolean;
  hovered: boolean;
  open: boolean;
  peek: PeekState | null;
  activities: Activity[];
}

export type IslandEvent =
  | { type: "hover.start" }
  | { type: "hover.end" }
  | { type: "press" }
  | { type: "close" }
  | { type: "peek.show"; id: string }
  | { type: "peek.expire"; id: string }
  | { type: "activity.set"; activity: Activity }
  | { type: "activity.clear"; id: string }
  | { type: "visibility"; visible: boolean };

export const initialState: IslandState = {
  visible: true,
  hovered: false,
  open: false,
  peek: null,
  activities: [],
};

export function reduce(state: IslandState, event: IslandEvent): IslandState {
  switch (event.type) {
    case "hover.start":
      return state.visible && !state.hovered ? { ...state, hovered: true } : state;

    case "hover.end": {
      if (!state.hovered) return state;
      const peek = state.peek?.expired ? null : state.peek;
      return { ...state, hovered: false, open: false, peek };
    }

    case "press":
      return state.visible && !state.open ? { ...state, open: true, peek: null } : state;

    case "close":
      return state.open ? { ...state, open: false } : state;

    case "peek.show":
      // An open panel already shows everything; a peek would only flash over it.
      if (!state.visible || state.open) return state;
      return { ...state, peek: { id: event.id, expired: false } };

    case "peek.expire":
      if (state.peek?.id !== event.id) return state;
      return state.hovered
        ? { ...state, peek: { ...state.peek, expired: true } }
        : { ...state, peek: null };

    case "activity.set": {
      const others = state.activities.filter((a) => a.id !== event.activity.id);
      return { ...state, activities: [...others, event.activity] };
    }

    case "activity.clear": {
      if (!state.activities.some((a) => a.id === event.id)) return state;
      return { ...state, activities: state.activities.filter((a) => a.id !== event.id) };
    }

    case "visibility":
      if (event.visible) return state.visible ? state : { ...state, visible: true };
      return { ...state, visible: false, hovered: false, open: false, peek: null };
  }
}

export function surfaceOf(state: IslandState): Surface {
  if (!state.visible) return "hidden";
  if (state.open) return "expanded";
  if (state.peek) return "peek";
  if (primaryActivity(state.activities)) return "activity";
  return "idle";
}
