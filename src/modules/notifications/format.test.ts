import { describe, expect, it } from "vitest";
import { arrivedLabel, splitLinks } from "./format";

describe("splitLinks", () => {
  it("leaves plain text alone", () => {
    expect(splitLinks("Salut, ça va ?")).toEqual([{ text: "Salut, ça va ?" }]);
  });

  it("finds links and leaves the sentence's punctuation out", () => {
    expect(splitLinks("Regarde https://github.com/quierapro/quiera-island. Trop bien")).toEqual([
      { text: "Regarde " },
      { text: "https://github.com/quierapro/quiera-island", url: "https://github.com/quierapro/quiera-island" },
      { text: ". Trop bien" },
    ]);
  });

  it("handles several links and one at the very start", () => {
    const parts = splitLinks("http://a.com et (https://b.fr/x?y=1)");
    expect(parts.filter((p) => p.url).map((p) => p.url)).toEqual(["http://a.com", "https://b.fr/x?y=1"]);
    expect(parts.map((p) => p.text).join("")).toBe("http://a.com et (https://b.fr/x?y=1)");
  });
});

describe("arrivedLabel", () => {
  const now = new Date(2026, 9, 29, 15, 0).getTime();
  it("gives the time today, then yesterday, then the date", () => {
    expect(arrivedLabel(new Date(2026, 9, 29, 14, 5).getTime(), now)).toBe("14:05");
    expect(arrivedLabel(new Date(2026, 9, 28, 9, 30).getTime(), now)).toBe("hier 09:30");
    expect(arrivedLabel(new Date(2026, 9, 20, 9, 30).getTime(), now)).toMatch(/20/);
  });
});
