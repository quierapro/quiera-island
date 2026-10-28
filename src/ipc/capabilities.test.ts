import { describe, expect, it } from "vitest";
import { isSupported, NO_CAPABILITIES } from "./capabilities";

describe("isSupported", () => {
  it("reports nothing as supported before the backend answers", () => {
    expect(isSupported(NO_CAPABILITIES, "media")).toBe(false);
    expect(isSupported(NO_CAPABILITIES, "islandWindow")).toBe(false);
  });

  it("follows the flag the backend sent", () => {
    const caps = { ...NO_CAPABILITIES, platform: "windows" as const, media: true };
    expect(isSupported(caps, "media")).toBe(true);
    expect(isSupported(caps, "volume")).toBe(false);
  });
});
