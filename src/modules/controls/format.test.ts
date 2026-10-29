import { describe, expect, it } from "vitest";
import { controlsContentSize, shownLevel } from "./format";

describe("controlsContentSize", () => {
  it("grows with the apps, up to three rows", () => {
    expect(controlsContentSize(0)).toEqual([460, 152]);
    expect(controlsContentSize(1)[1]).toBe(152 + 22 + 34);
    expect(controlsContentSize(8)).toEqual(controlsContentSize(3));
  });
});

describe("shownLevel", () => {
  it("keeps the user's value while they drag, then follows the system", () => {
    const local = { level: 70, at: 1000 };
    expect(shownLevel(40, local, 1500)).toBe(70);
    expect(shownLevel(40, local, 3000)).toBe(40);
    expect(shownLevel(40, undefined, 1500)).toBe(40);
  });
});
