import { describe, expect, it } from "vitest";
import { BIRTH, targetBox, targetFor } from "./geometry";

describe("targetFor", () => {
  it("grows from idle to activity to peek to expanded", () => {
    const widths = (["idle", "activity", "peek", "expanded"] as const).map((s) => targetFor(s, false).width);
    expect(widths).toEqual([124, 200, 340, 600]);
  });

  it("grows a compact island slightly on hover, but not the open panel", () => {
    expect(targetFor("idle", true)).toMatchObject({ width: 134, height: 36, bottomRadius: 18 });
    expect(targetFor("expanded", true)).toEqual(targetFor("expanded", false));
  });

  it("is opaque black in every state (OLED)", () => {
    for (const s of ["idle", "activity", "peek", "expanded"] as const) {
      expect(targetFor(s, false).fill).toBe(1);
    }
  });

  it("lets the module choose its size", () => {
    expect(targetFor("expanded", false, [620, 176, 30])).toMatchObject({ width: 620, height: 176, bottomRadius: 30 });
  });

  it("hides above the screen edge", () => {
    const t = targetFor("hidden", false);
    expect(t.y + t.height).toBeLessThan(0);
  });
});

describe("targetBox", () => {
  it("covers the idle silhouette centered in the window", () => {
    expect(targetBox(targetFor("idle", false), 680)).toEqual({ x: 263, y: 0, width: 154, height: 36 });
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
