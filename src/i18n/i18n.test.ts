import { describe, expect, it } from "vitest";
import { en } from "./en";
import { fr } from "./fr";
import { resolveLang } from "./index";

describe("resolveLang", () => {
  it("follows the setting, or Windows' language for system", () => {
    expect(resolveLang("fr", "en-US")).toBe("fr");
    expect(resolveLang("en", "fr-FR")).toBe("en");
    expect(resolveLang("system", "fr-CA")).toBe("fr");
    expect(resolveLang("system", "de-DE")).toBe("en");
  });
});

describe("dictionaries", () => {
  it("write counts and sizes each in their own way", () => {
    expect(fr.shelf.count(1)).toBe("1 élément");
    expect(en.shelf.count(3)).toBe("3 items");
    expect(en.shortcut("Ctrl+Maj+Espace")).toBe("Ctrl+Shift+Space");
    expect(fr.shortcut("Ctrl+Maj+Espace")).toBe("Ctrl+Maj+Espace");
    expect(en.percent(76)).toBe("76%");
  });
});
