import { describe, expect, it } from "vitest";
import { frameStats } from "./bench";

describe("frameStats", () => {
  it("summarises the gaps between frames", () => {
    expect(frameStats([0, 16, 33, 83, 100])).toEqual({ frames: 5, meanMs: 25, maxMs: 50, over20ms: 1 });
  });

  it("handles a single frame", () => {
    expect(frameStats([5])).toEqual({ frames: 1, meanMs: 0, maxMs: 0, over20ms: 0 });
  });
});
