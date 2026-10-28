import { describe, expect, it } from "vitest";
import { initialState, reduce, surfaceOf, type IslandEvent, type IslandState } from "./island-machine";

function run(...events: IslandEvent[]): IslandState {
  return events.reduce(reduce, initialState);
}

const music = { type: "activity.set", activity: { id: "media", priority: 10 } } as const;

describe("surfaceOf", () => {
  it("starts idle", () => {
    expect(surfaceOf(initialState)).toBe("idle");
  });

  it("shows a live activity", () => {
    expect(surfaceOf(run(music))).toBe("activity");
    expect(surfaceOf(run(music, { type: "activity.clear", id: "media" }))).toBe("idle");
  });

  it("puts a peek above the activity, and returns to it afterwards", () => {
    const s = run(music, { type: "peek.show", id: "p1" });
    expect(surfaceOf(s)).toBe("peek");
    expect(surfaceOf(reduce(s, { type: "peek.expire", id: "p1" }))).toBe("activity");
  });

  it("puts the open panel above everything", () => {
    expect(surfaceOf(run(music, { type: "peek.show", id: "p1" }, { type: "press" }))).toBe("expanded");
  });

  it("is hidden whatever else is going on", () => {
    expect(surfaceOf(run(music, { type: "press" }, { type: "visibility", visible: false }))).toBe("hidden");
  });
});

describe("opening and closing", () => {
  it("opens on press and closes when the pointer leaves", () => {
    const open = run({ type: "hover.start" }, { type: "press" });
    expect(open.open).toBe(true);
    expect(reduce(open, { type: "hover.end" }).open).toBe(false);
  });

  it("closes on request", () => {
    expect(run({ type: "press" }, { type: "close" }).open).toBe(false);
  });

  it("drops the peek when the panel opens", () => {
    expect(run({ type: "peek.show", id: "p1" }, { type: "press" }).peek).toBeNull();
  });

  it("ignores a press while hidden", () => {
    expect(run({ type: "visibility", visible: false }, { type: "press" }).open).toBe(false);
  });
});

describe("peeks", () => {
  it("is ignored while the panel is open", () => {
    expect(run({ type: "press" }, { type: "peek.show", id: "p1" }).peek).toBeNull();
  });

  it("is replaced by a newer peek, and an old expiry does not remove the new one", () => {
    const s = run({ type: "peek.show", id: "p1" }, { type: "peek.show", id: "p2" }, { type: "peek.expire", id: "p1" });
    expect(s.peek).toEqual({ id: "p2", expired: false });
  });

  it("stays while hovered past its time, then leaves with the pointer", () => {
    const hovered = run({ type: "peek.show", id: "p1" }, { type: "hover.start" }, { type: "peek.expire", id: "p1" });
    expect(surfaceOf(hovered)).toBe("peek");
    expect(surfaceOf(reduce(hovered, { type: "hover.end" }))).toBe("idle");
  });

  it("is kept when the pointer leaves before its time is up", () => {
    const s = run({ type: "peek.show", id: "p1" }, { type: "hover.start" }, { type: "hover.end" });
    expect(s.peek).toEqual({ id: "p1", expired: false });
  });
});

describe("activities", () => {
  it("replaces an activity with the same id instead of duplicating it", () => {
    const s = run(music, { type: "activity.set", activity: { id: "media", priority: 5 } });
    expect(s.activities).toEqual([{ id: "media", priority: 5 }]);
  });

  it("returns the same state when clearing an unknown activity", () => {
    const s = run(music);
    expect(reduce(s, { type: "activity.clear", id: "nope" })).toBe(s);
  });
});

describe("visibility", () => {
  it("resets hover, panel and peek when hidden", () => {
    const s = run({ type: "hover.start" }, { type: "press" }, { type: "visibility", visible: false });
    expect(s).toMatchObject({ visible: false, hovered: false, open: false, peek: null });
  });

  it("keeps live activities while hidden", () => {
    const s = run(music, { type: "visibility", visible: false }, { type: "visibility", visible: true });
    expect(surfaceOf(s)).toBe("activity");
  });

  it("ignores hover while hidden", () => {
    expect(run({ type: "visibility", visible: false }, { type: "hover.start" }).hovered).toBe(false);
  });
});
