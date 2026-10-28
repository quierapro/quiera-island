import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIslandController, TIMING } from "./controller";
import type { IslandEvent } from "./island-machine";

let events: IslandEvent[];
let controller: ReturnType<typeof createIslandController>;

// Most tests look at hover and peeks alone; opening on hover has its own block.
const CLICK_ONLY = { ...TIMING, hoverOpenMs: null };

beforeEach(() => {
  vi.useFakeTimers();
  events = [];
  controller = createIslandController((e) => events.push(e), CLICK_ONLY);
});

afterEach(() => {
  controller.dispose();
  vi.useRealTimers();
});

const types = () => events.map((e) => e.type);

describe("hover intent", () => {
  it("starts hovering only after the pointer rests on the island", () => {
    controller.pointerEnter();
    vi.advanceTimersByTime(TIMING.hoverIntentMs - 1);
    expect(types()).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(types()).toEqual(["hover.start"]);
  });

  it("ignores a pointer that only passes through", () => {
    controller.pointerEnter();
    vi.advanceTimersByTime(TIMING.hoverIntentMs / 2);
    controller.pointerLeave();
    vi.advanceTimersByTime(1000);
    expect(types()).toEqual([]);
  });
});

describe("hover grace", () => {
  function hover() {
    controller.pointerEnter();
    vi.advanceTimersByTime(TIMING.hoverIntentMs);
    events = [];
  }

  it("ends hovering after the grace period", () => {
    hover();
    controller.pointerLeave();
    vi.advanceTimersByTime(TIMING.hoverGraceMs - 1);
    expect(types()).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(types()).toEqual(["hover.end"]);
  });

  it("forgives a short exit: no flicker at the edge", () => {
    hover();
    for (let i = 0; i < 20; i++) {
      controller.pointerLeave();
      vi.advanceTimersByTime(50);
      controller.pointerEnter();
      vi.advanceTimersByTime(50);
    }
    vi.advanceTimersByTime(1000);
    expect(types()).toEqual([]);
  });
});

describe("press", () => {
  it("hovers at once and presses, without waiting for the intent delay", () => {
    controller.press();
    expect(types()).toEqual(["hover.start", "press"]);
  });

  it("does not send a second hover.start when already hovering", () => {
    controller.pointerEnter();
    vi.advanceTimersByTime(TIMING.hoverIntentMs);
    controller.press();
    expect(types()).toEqual(["hover.start", "press"]);
  });

  it("cancels a pending hover end", () => {
    controller.press();
    controller.pointerLeave();
    controller.press();
    vi.advanceTimersByTime(1000);
    expect(types()).toEqual(["hover.start", "press", "press"]);
  });
});

describe("peeks", () => {
  it("expires after its hold time", () => {
    controller.showPeek("p1");
    vi.advanceTimersByTime(TIMING.peekHoldMs);
    expect(events).toEqual([
      { type: "peek.show", id: "p1" },
      { type: "peek.expire", id: "p1" },
    ]);
  });

  it("restarts the clock for a newer peek", () => {
    controller.showPeek("p1");
    vi.advanceTimersByTime(TIMING.peekHoldMs - 100);
    controller.showPeek("p2");
    vi.advanceTimersByTime(TIMING.peekHoldMs - 1);
    expect(types()).toEqual(["peek.show", "peek.show"]);
    vi.advanceTimersByTime(1);
    expect(events.at(-1)).toEqual({ type: "peek.expire", id: "p2" });
  });
});

describe("resetPointer", () => {
  it("lets the next hover start again after the island was hidden", () => {
    controller.press();
    controller.resetPointer();
    events = [];
    controller.pointerEnter();
    vi.advanceTimersByTime(TIMING.hoverIntentMs);
    expect(types()).toEqual(["hover.start"]);
  });
});

describe("open on hover", () => {
  it("opens with the hover itself by default: one motion, no step in between", () => {
    controller.dispose();
    controller = createIslandController((e) => events.push(e), TIMING);
    controller.pointerEnter();
    vi.advanceTimersByTime(TIMING.hoverIntentMs - 1);
    expect(types()).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(types()).toEqual(["hover.start", "press"]);
  });

  it("still ignores a pointer that only passes through", () => {
    controller.dispose();
    controller = createIslandController((e) => events.push(e), TIMING);
    controller.pointerEnter();
    vi.advanceTimersByTime(TIMING.hoverIntentMs - 10);
    controller.pointerLeave();
    vi.advanceTimersByTime(2000);
    expect(types()).toEqual([]);
  });

  describe("with a delay", () => {
    const DELAYED = { ...TIMING, hoverIntentMs: 120, hoverOpenMs: 260 };

    beforeEach(() => {
      controller.dispose();
      controller = createIslandController((e) => events.push(e), DELAYED);
    });

    it("opens once the pointer has rested a little longer", () => {
      controller.pointerEnter();
      vi.advanceTimersByTime(120 + 260 - 1);
      expect(types()).toEqual(["hover.start"]);
      vi.advanceTimersByTime(1);
      expect(types()).toEqual(["hover.start", "press"]);
    });

    it("does not open for a pointer that leaves before", () => {
      controller.pointerEnter();
      vi.advanceTimersByTime(120 + 50);
      controller.pointerLeave();
      vi.advanceTimersByTime(2000);
      expect(types()).toEqual(["hover.start", "hover.end"]);
    });

    it("still opens after a short exit within the grace period", () => {
      controller.pointerEnter();
      vi.advanceTimersByTime(120 + 50);
      controller.pointerLeave();
      vi.advanceTimersByTime(100);
      controller.pointerEnter();
      vi.advanceTimersByTime(260);
      expect(types()).toEqual(["hover.start", "press"]);
    });

    it("does not open a second time after a click", () => {
      controller.pointerEnter();
      vi.advanceTimersByTime(120);
      controller.press();
      vi.advanceTimersByTime(1000);
      expect(types()).toEqual(["hover.start", "press"]);
    });
  });

  it("can be turned off", () => {
    controller.pointerEnter();
    vi.advanceTimersByTime(5000);
    expect(types()).toEqual(["hover.start"]);
  });
});
