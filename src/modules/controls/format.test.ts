import { describe, expect, it } from "vitest";
import { controlsContentSize, levelAt, shownLevel } from "./format";
import { keepOrder } from "./store";

describe("controlsContentSize", () => {
  it("grows with the apps, up to three rows", () => {
    expect(controlsContentSize(0)).toEqual([460, 158]);
    expect(controlsContentSize(1)[1]).toBe(158 + 30 + 34);
    expect(controlsContentSize(8)).toEqual(controlsContentSize(3));
  });

  it("makes room for the outputs list when it unfolds", () => {
    expect(controlsContentSize(0, true)).toEqual(controlsContentSize(3));
  });

  it("fits under the tab bar in the window", () => {
    expect(controlsContentSize(9, true)[1] + 32).toBeLessThanOrEqual(376);
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

describe("levelAt", () => {
  it("maps the pointer across the slider, clamped", () => {
    expect(levelAt(150, 100, 200)).toBe(25);
    expect(levelAt(50, 100, 200)).toBe(0);
    expect(levelAt(400, 100, 200)).toBe(100);
  });
});

describe("keepOrder", () => {
  const app = (key: string) => ({ key, name: key, icon: "", level: 50, muted: false });
  it("keeps known apps where they were and adds newcomers after", () => {
    const previous = [app("spotify"), app("discord"), app("chrome")];
    const next = [app("chrome"), app("steam"), app("spotify")];
    expect(keepOrder(previous, next).map((a) => a.key)).toEqual(["spotify", "chrome", "steam"]);
  });
});
