import { describe, expect, it } from "vitest";
import { orderTabs, tabShown, TABS } from "./tabs";

const def = (id: string) => TABS.find((t) => t.id === id)!;
const ids = (order: string[]) => orderTabs(order).map((t) => t.id);

describe("orderTabs", () => {
  it("keeps the default order when the settings give none", () => {
    expect(ids([])).toEqual(["home", "timer", "controls", "notifications", "shelf", "clipboard"]);
  });

  it("follows the settings, the tabs they omit after, home always first", () => {
    expect(ids(["clipboard", "home", "controls"])).toEqual(["home", "clipboard", "controls", "timer", "notifications", "shelf"]);
  });

  it("ignores ids it does not know (a removed plugin)", () => {
    expect(ids(["plugin:gone", "shelf"])[1]).toBe("shelf");
  });
});

describe("tabShown", () => {
  it("offers the always tabs, the others once they hold something", () => {
    expect(tabShown(def("controls"), "home", 0, [])).toBe(true);
    expect(tabShown(def("timer"), "home", 0, [])).toBe(true);
    expect(tabShown(def("clipboard"), "home", 0, [])).toBe(false);
    expect(tabShown(def("clipboard"), "home", 2, [])).toBe(true);
  });

  it("leaves out hidden tabs, but never home nor the one on screen", () => {
    expect(tabShown(def("timer"), "home", 0, ["timer"])).toBe(false);
    expect(tabShown(def("clipboard"), "home", 3, ["clipboard"])).toBe(false);
    expect(tabShown(def("home"), "timer", 0, ["home"])).toBe(true);
    expect(tabShown(def("timer"), "timer", 0, ["timer"])).toBe(true);
  });
});
