import { describe, expect, it } from "vitest";
import { leftAt, paused, progressAt, resumed, ringing, started } from "./state";

const MIN = 60_000;

describe("timer state", () => {
  it("runs down with the time", () => {
    const t = started(5 * MIN, false, 1000);
    expect(leftAt(t, 1000)).toBe(5 * MIN);
    expect(leftAt(t, 1000 + MIN)).toBe(4 * MIN);
    expect(leftAt(t, 1000 + 6 * MIN)).toBe(0);
    expect(progressAt(t, 1000 + 2.5 * MIN)).toBe(0.5);
  });

  it("keeps what is left while paused", () => {
    const t = paused(started(5 * MIN, false, 0), MIN);
    expect(leftAt(t, 10 * MIN)).toBe(4 * MIN);
    const again = resumed(t, 10 * MIN);
    expect(again.phase).toBe("running");
    expect(leftAt(again, 11 * MIN)).toBe(3 * MIN);
  });

  it("is over when ringing", () => {
    const t = ringing(started(MIN, false, 0));
    expect(leftAt(t, 0)).toBe(0);
    expect(progressAt(t, 0)).toBe(1);
  });
});
