import { describe, expect, it } from "vitest";
import { slowed, SPRINGS } from "./springs";

/** Damping ratio ζ = c / (2√(k·m)): below 1 bounces, 1 or more does not. */
function dampingRatio(s: { stiffness: number; damping: number; mass?: number }): number {
  return s.damping / (2 * Math.sqrt(s.stiffness * (s.mass ?? 1)));
}

describe("springs", () => {
  it("opens with a little bounce and closes with less", () => {
    expect(dampingRatio(SPRINGS.widthOpen)).toBeLessThan(dampingRatio(SPRINGS.widthClose));
    expect(dampingRatio(SPRINGS.heightOpen)).toBeLessThan(dampingRatio(SPRINGS.heightClose));
  });

  it("keeps the bounce when slowed down: only time stretches", () => {
    const slow = slowed(SPRINGS.widthOpen, 4);
    expect(dampingRatio(slow)).toBeCloseTo(dampingRatio(SPRINGS.widthOpen), 10);
    expect(slow.stiffness).toBe(SPRINGS.widthOpen.stiffness / 16);
  });

  it("returns the spring itself at normal speed", () => {
    expect(slowed(SPRINGS.y, 1)).toBe(SPRINGS.y);
  });
});
