import { describe, expect, it } from "vitest";
import { tabShown } from "./TabBar";

describe("tabShown", () => {
  it("always offers home, the others once they hold something or while shown", () => {
    expect(tabShown("home", "home", 0)).toBe(true);
    expect(tabShown("controls", "home", 0)).toBe(true);
    expect(tabShown("clipboard", "home", 0)).toBe(false);
    expect(tabShown("clipboard", "home", 2)).toBe(true);
    expect(tabShown("shelf", "shelf", 0)).toBe(true);
  });
});
