import { describe, expect, it } from "vitest";
import { formatSize, shelfContentSize } from "./format";

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
