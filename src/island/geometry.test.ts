import { describe, expect, it } from "vitest";
import { BIRTH, targetBox, targetFor } from "./geometry";

describe("targetFor", () => {
  it("grows from idle to activity to peek to expanded", () => {
    const widths = (["idle", "activity", "peek", "expanded"] as const).map((s) => targetFor(s, false).width);
    expect(widths).toEqual([190, 230, 340, 600]);
  });

  it("grows a compact island slightly on hover, but not the open panel", () => {
    expect(targetFor("idle", true)).toMatchObject({ width: 200, height: 32, bottomRadius: 16 });
    expect(targetFor("expanded", true)).toEqual(targetFor("expanded", false));
  });

  it("darkens the fill when expanded", () => {
    expect(targetFor("expanded", false).fill).toBeGreaterThan(targetFor("idle", false).fill);
  });

  it("hides above the screen edge", () => {
    const t = targetFor("hidden", false);
    expect(t.y + t.height).toBeLessThan(0);
  });
});

describe("targetBox", () => {
  it("covers the idle silhouette centered in the window", () => {
    expect(targetBox(targetFor("idle", false), 680)).toEqual({ x: 230, y: 0, width: 220, height: 32 });
  });

  it("reaches from the edge down to the birth bubble", () => {
    const box = targetBox(BIRTH, 680)!;
    expect(box.y).toBe(0);
    expect(box.height).toBe(BIRTH.y + BIRTH.height + 2);
  });

  it("is null when hidden", () => {
    expect(targetBox(targetFor("hidden", false), 680)).toBeNull();
  });
});
