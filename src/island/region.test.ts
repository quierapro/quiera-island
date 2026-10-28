import { describe, expect, it } from "vitest";
import { EMPTY_REGION, nextRegion } from "./region";

const small = { x: 230, y: 0, width: 220, height: 32 };
const large = { x: 40, y: 0, width: 600, height: 200 };
const HOLD = 600;

describe("nextRegion", () => {
  it("applies the first region as is", () => {
    const r = nextRegion(EMPTY_REGION, [small], 0, HOLD);
    expect(r.rects).toEqual([small]);
    expect(r.nextExpiry).toBeNull();
  });

  it("grows at once and holds the smaller region it leaves (harmless, it is inside)", () => {
    const first = nextRegion(EMPTY_REGION, [small], 0, HOLD);
    const grown = nextRegion(first.state, [large], 100, HOLD);
    expect(grown.rects[0]).toEqual(large);
  });

  it("holds the larger region while shrinking, then lets it go", () => {
    const first = nextRegion(EMPTY_REGION, [large], 0, HOLD);
    const shrunk = nextRegion(first.state, [small], 1000, HOLD);
    expect(shrunk.rects).toEqual([small, large]);
    expect(shrunk.nextExpiry).toBe(1000 + HOLD);

    const settled = nextRegion(shrunk.state, [small], 1000 + HOLD, HOLD);
    expect(settled.rects).toEqual([small]);
    expect(settled.nextExpiry).toBeNull();
  });

  it("does not hold anything when nothing changed", () => {
    const first = nextRegion(EMPTY_REGION, [small], 0, HOLD);
    const again = nextRegion(first.state, [small], 50, HOLD);
    expect(again.state.held).toEqual([]);
  });

  it("holds the shape while hiding, then empties the region", () => {
    const first = nextRegion(EMPTY_REGION, [small], 0, HOLD);
    const hiding = nextRegion(first.state, [], 10, HOLD);
    expect(hiding.rects).toEqual([small]);
    expect(nextRegion(hiding.state, [], 10 + HOLD, HOLD).rects).toEqual([]);
  });
});
