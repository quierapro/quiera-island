import { describe, expect, it } from "vitest";
import { completeSettings, DEFAULT_SETTINGS } from "./settings";

describe("completeSettings", () => {
  it("fills a section an older backend does not send", () => {
    const { calendar, ...older } = DEFAULT_SETTINGS;
    expect(calendar).toBeDefined();
    expect(completeSettings(older).calendar).toEqual(DEFAULT_SETTINGS.calendar);
  });

  it("fills a field missing from a section, and keeps what is sent", () => {
    const sent = { ...DEFAULT_SETTINGS, peeks: { power: false, audioDevice: true, capsLock: true, volume: true } };
    const settings = completeSettings(sent as never);
    expect(settings.peeks.power).toBe(false);
    expect(settings.peeks.bluetooth).toBe(true);
    expect(completeSettings({ ...DEFAULT_SETTINGS, version: 3 }).version).toBe(3);
  });

  it("gives the defaults for nothing at all", () => {
    expect(completeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});
