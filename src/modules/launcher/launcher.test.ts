import { describe, expect, it } from "vitest";
import { calculate, formatNumber } from "./calc";
import { launcherSize, normalize, rank, score } from "./search";
import { asksForSettings, compose, MAX_ROWS } from "./results";

const apps = ["Visual Studio Code", "Spotify", "Steam", "Discord", "Discord Canary", "Paramètres", "Microsoft Edge", "Bloc-notes"].map(
  (name) => ({ key: name, name, icon: "" }),
);
const names = (query: string, usage?: Record<string, number>) => rank(apps, query, usage).map((a) => a.name);

describe("score and rank", () => {
  it("ignores case and accents", () => {
    expect(normalize("Paramètres")).toBe("parametres");
    expect(names("parametres")[0]).toBe("Paramètres");
  });

  it("puts the start of the name first", () => {
    expect(names("sp")[0]).toBe("Spotify");
    expect(names("disc")).toEqual(["Discord", "Discord Canary"]);
  });

  it("finds a word inside the name, and initials", () => {
    expect(names("code")[0]).toBe("Visual Studio Code");
    expect(names("vsc")[0]).toBe("Visual Studio Code");
    expect(names("edge")[0]).toBe("Microsoft Edge");
  });

  it("matches every word of a multi-word query", () => {
    expect(names("visual code")[0]).toBe("Visual Studio Code");
  });

  it("forgives missing letters, but not on two letters", () => {
    expect(names("sptfy")[0]).toBe("Spotify");
    expect(score("Steam", "sm")).toBe(0);
  });

  it("lets apps opened often climb", () => {
    expect(names("disc", { "Discord Canary": 5 })[0]).toBe("Discord Canary");
  });

  it("finds nothing for nothing", () => {
    expect(names("")).toEqual([]);
    expect(names("zzzz")).toEqual([]);
  });
});

describe("calculate", () => {
  it("computes with priorities and parentheses", () => {
    expect(calculate("12*7")).toBe(84);
    expect(calculate("2 + 3 * 4")).toBe(14);
    expect(calculate("(2 + 3) * 4")).toBe(20);
    expect(calculate("2^10")).toBe(1024);
    expect(calculate("-3 + 5")).toBe(2);
    expect(calculate("2(3+4)")).toBe(14);
  });

  it("reads French decimals and signs", () => {
    expect(calculate("3,5 x 2")).toBe(7);
    expect(calculate("10 ÷ 4")).toBe(2.5);
  });

  it("is not fooled by plain text or numbers alone", () => {
    expect(calculate("spotify")).toBeNull();
    expect(calculate("42")).toBeNull();
    expect(calculate("2 +")).toBeNull();
    expect(calculate("(2")).toBeNull();
    expect(calculate("1/0")).toBeNull();
  });

  it("formats like French", () => {
    expect(formatNumber(1234.5).replace(/\s/g, " ")).toBe("1 234,5");
  });
});

describe("launcherSize", () => {
  it("grows by one row per result", () => {
    expect(launcherSize(0)).toEqual([640, 58, 28]);
    expect(launcherSize(3)[1]).toBe(58 + 8 + 3 * 42);
  });
});

describe("compose", () => {
  const file = (id: number) => ({ id, generation: 1, name: `f${id}.txt`, folder: "C:\\", dir: false, icon: "", modified: 0 });
  const files = [1, 2, 3, 4, 5, 6, 7, 8].map(file);

  it("puts apps first, files after, the web last, within the window", () => {
    const list = compose("disc", apps, files, {});
    expect(list.map((r) => r.kind)).toEqual(["app", "app", "file", "file", "file", "file", "web"]);
    expect(list.length).toBeLessThanOrEqual(MAX_ROWS);
    expect(launcherSize(list.length)[1]).toBeLessThanOrEqual(376);
  });

  it("gives files the room apps do not take, and a calculation its row", () => {
    expect(compose("zzz", apps, files, {}).filter((r) => r.kind === "file")).toHaveLength(6);
    expect(compose("2+2", apps, files, {}).map((r) => r.kind)[0]).toBe("calc");
  });

  it("shows nothing for nothing", () => {
    expect(compose("  ", apps, files, {})).toEqual([]);
  });
});

describe("asksForSettings", () => {
  it("opens Quiera's settings from a few words", () => {
    expect(asksForSettings("régl")).toBe(true);
    expect(asksForSettings("Paramètres")).toBe(true);
    expect(asksForSettings("settings")).toBe(true);
    expect(asksForSettings("re")).toBe(false);
    expect(asksForSettings("spotify")).toBe(false);
    expect(compose("reglages", apps, [], {})[0].kind).toBe("settings");
  });
});
