import { describe, expect, it } from "vitest";
import { formatDay, msUntilNextMinute } from "./time";

describe("msUntilNextMinute", () => {
  it("waits for the rest of the current minute", () => {
    expect(msUntilNextMinute(new Date(2026, 9, 28, 16, 30, 15, 250))).toBe(44_750);
  });

  it("waits a full minute exactly on the minute", () => {
    expect(msUntilNextMinute(new Date(2026, 9, 28, 16, 30, 0, 0))).toBe(60_000);
  });
});

describe("formatDay", () => {
  it("starts with a capital letter", () => {
    const text = formatDay(new Date(2026, 9, 28));
    expect(text.charAt(0)).toBe(text.charAt(0).toUpperCase());
    expect(text).toMatch(/28/);
  });
});
