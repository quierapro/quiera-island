import { describe, expect, it } from "vitest";
import { bodyPath, clampRadii, FLARE, leftFlarePath, rightFlarePath, silhouetteWidth } from "./shell";

const IDLE = { width: 190, height: 30, topRadius: 0, bottomRadius: 15 };

describe("silhouetteWidth", () => {
  it("leaves room for a flare on each side", () => {
    expect(silhouetteWidth(190)).toBe(190 + 2 * FLARE);
  });
});

describe("clampRadii", () => {
  it("keeps radii that fit", () => {
    expect(clampRadii(IDLE)).toEqual({ top: 0, bottom: 15 });
  });

  it("makes a circle of a square with large radii (the birth bubble)", () => {
    expect(clampRadii({ width: 34, height: 34, topRadius: 17, bottomRadius: 17 })).toEqual({ top: 17, bottom: 17 });
    expect(clampRadii({ width: 34, height: 34, topRadius: 40, bottomRadius: 40 })).toEqual({ top: 17, bottom: 17 });
  });

  it("never lets the corners overlap vertically", () => {
    expect(clampRadii({ width: 200, height: 30, topRadius: 20, bottomRadius: 20 })).toEqual({ top: 15, bottom: 15 });
  });

  it("never goes negative", () => {
    expect(clampRadii({ width: 10, height: 10, topRadius: -3, bottomRadius: -1 })).toEqual({ top: 0, bottom: 0 });
  });
});

describe("bodyPath", () => {
  it("draws the attached idle body: flat top, rounded bottom", () => {
    expect(bodyPath(IDLE)).toBe(
      "M 13 0 L 203 0 A 0 0 0 0 1 203 0 L 203 15 A 15 15 0 0 1 188 30 L 28 30 A 15 15 0 0 1 13 15 L 13 0 A 0 0 0 0 1 13 0 Z",
    );
  });
});

describe("flares", () => {
  it("bridges the screen edge into the body's left side", () => {
    expect(leftFlarePath()).toBe("M 0 0 C 10.01 0 13 2.99 13 13 L 14 13 L 14 0 Z");
  });

  it("mirrors on the right, following the body width", () => {
    expect(rightFlarePath(190)).toBe("M 216 0 C 205.99 0 203 2.99 203 13 L 202 13 L 202 0 Z");
  });
});
