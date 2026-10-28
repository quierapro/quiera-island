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

/** What the open panel shows: "home" is the player, or the clock without music. */
export type Tab = "home" | "shelf";

export interface IslandState {
  visible: boolean;
  hovered: boolean;
  open: boolean;
  tab: Tab;
  /** Files are being dragged over the island. */
  dragging: boolean;
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
  | { type: "visibility"; visible: boolean }
  | { type: "tab.select"; tab: Tab }
  | { type: "drag.enter" }
  | { type: "drag.leave" }
  | { type: "drag.drop" };

export const initialState: IslandState = {
  visible: true,
  hovered: false,
  open: false,
  tab: "home",
  dragging: false,
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
      // Files still being dragged over it keep the island open.
      return { ...state, hovered: false, open: state.dragging, peek };
    }

    case "press":
      // Opening always starts at home.
      return state.visible && !state.open ? { ...state, open: true, tab: "home", peek: null } : state;

    case "close":
      return state.open ? { ...state, open: false, dragging: false } : state;

    case "tab.select":
      return state.open && state.tab !== event.tab ? { ...state, tab: event.tab } : state;

    case "drag.enter":
      // Files on the way: open on the shelf, ready to catch them.
      if (!state.visible) return state;
      return { ...state, dragging: true, open: true, tab: "shelf", peek: null };

    case "drag.leave":
      if (!state.dragging) return state;
      return { ...state, dragging: false, open: state.hovered };

    case "drag.drop":
      // Stays open to show what landed; the controller closes it later.
      return state.dragging ? { ...state, dragging: false } : state;

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
      return { ...state, visible: false, hovered: false, open: false, dragging: false, peek: null };
  }
}

export function surfaceOf(state: IslandState): Surface {
  if (!state.visible) return "hidden";
  if (state.open) return "expanded";
  if (state.peek) return "peek";
  if (primaryActivity(state.activities)) return "activity";
  return "idle";
}
