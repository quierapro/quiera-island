import { describe, expect, it } from "vitest";
import { countdown, formatSize, shelfContentSize } from "./format";

describe("formatSize", () => {
  it("picks a readable unit", () => {
    expect(formatSize(3, "fr")).toBe("3 o");
    expect(formatSize(402_300, "fr")).toBe("402 Ko");
    expect(formatSize(2_400_000, "fr")).toBe("2,4 Mo");
    expect(formatSize(1_500_000_000, "fr")).toBe("1,5 Go");
  });
});

describe("shelfContentSize", () => {
  it("is smaller when empty", () => {
    expect(shelfContentSize(0)[0]).toBeLessThan(shelfContentSize(3)[0]);
  });
});

describe("countdown", () => {
  it("reads minutes and seconds", () => {
    expect(countdown(600)).toBe("10:00");
    expect(countdown(65)).toBe("1:05");
    expect(countdown(0)).toBe("0:00");
    expect(countdown(-3)).toBe("0:00");
  });
});
