import { describe, expect, it } from "vitest";
import { formatCountdown, formatDuration, parseDuration, timerRequests } from "./duration";

const MIN = 60_000;

describe("parseDuration", () => {
  it("reads units, as they are typed", () => {
    expect(parseDuration("5 min")).toBe(5 * MIN);
    expect(parseDuration("5m")).toBe(5 * MIN);
    expect(parseDuration("5 mi")).toBe(5 * MIN);
    expect(parseDuration("10 minutes")).toBe(10 * MIN);
    expect(parseDuration("90s")).toBe(90_000);
    expect(parseDuration("30 secondes")).toBe(30_000);
    expect(parseDuration("2 heures")).toBe(120 * MIN);
  });

  it("follows the unit before a bare number", () => {
    expect(parseDuration("1h30")).toBe(90 * MIN);
    expect(parseDuration("1 h 30")).toBe(90 * MIN);
    expect(parseDuration("2m30")).toBe(150_000);
    expect(parseDuration("1h 5min 10s")).toBe(65 * MIN + 10_000);
  });

  it("takes decimals with a comma or a dot", () => {
    expect(parseDuration("1,5 h")).toBe(90 * MIN);
    expect(parseDuration("0.5min")).toBe(30_000);
  });

  it("leaves a lone number to the calculator, unless after the word", () => {
    expect(parseDuration("5")).toBeNull();
    expect(parseDuration("5", true)).toBe(5 * MIN);
  });

  it("refuses anything else", () => {
    expect(parseDuration("7zip")).toBeNull();
    expect(parseDuration("2fa")).toBeNull();
    expect(parseDuration("min")).toBeNull();
    expect(parseDuration("0 min")).toBeNull();
    expect(parseDuration("25 h")).toBeNull();
    expect(parseDuration("")).toBeNull();
  });
});

describe("timerRequests", () => {
  it("offers a duration typed alone or after the word", () => {
    expect(timerRequests("5 min")).toEqual([{ ms: 5 * MIN, pomodoro: false }]);
    expect(timerRequests("Minuteur 10")).toEqual([{ ms: 10 * MIN, pomodoro: false }]);
    expect(timerRequests("timer 1h")).toEqual([{ ms: 60 * MIN, pomodoro: false }]);
    expect(timerRequests("compte à rebours 3 min")).toEqual([{ ms: 3 * MIN, pomodoro: false }]);
  });

  it("offers a few durations for the word alone", () => {
    expect(timerRequests("minuteur").map((r) => r.ms / MIN)).toEqual([1, 5, 10, 15]);
  });

  it("knows the pomodoro", () => {
    expect(timerRequests("pomo")).toEqual([{ ms: 25 * MIN, pomodoro: true }]);
    expect(timerRequests("pom")).toEqual([]);
  });

  it("stays out of the way of apps and calculations", () => {
    expect(timerRequests("spotify")).toEqual([]);
    expect(timerRequests("12")).toEqual([]);
    expect(timerRequests("3*4")).toEqual([]);
  });
});

describe("formats", () => {
  it("names durations", () => {
    expect(formatDuration(5 * MIN)).toBe("5 min");
    expect(formatDuration(90 * MIN)).toBe("1 h 30 min");
    expect(formatDuration(90_000)).toBe("1 min 30 s");
    expect(formatDuration(45_000)).toBe("45 s");
  });

  it("counts down like a clock, ending on 0:01", () => {
    expect(formatCountdown(5 * MIN)).toBe("5:00");
    expect(formatCountdown(299_001)).toBe("5:00");
    expect(formatCountdown(299_000)).toBe("4:59");
    expect(formatCountdown(1)).toBe("0:01");
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(65 * MIN + 9_000)).toBe("1:05:09");
  });
});
