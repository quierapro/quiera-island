import { describe, expect, it } from "vitest";
import type { ClipItem } from "../../ipc/clipboard";
import { ordered, timeAgo } from "./format";

const item = (id: number, copiedAt: number, pinned = false): ClipItem => ({
  id,
  kind: "text",
  preview: String(id),
  host: null,
  thumbnail: null,
  pinned,
  copiedAt,
});

describe("timeAgo", () => {
  const now = 1_000_000_000;
  it("reads like a person would say it", () => {
    expect(timeAgo(now - 20_000, now)).toBe("à l'instant");
    expect(timeAgo(now - 5 * 60_000, now)).toBe("il y a 5 min");
    expect(timeAgo(now - 2 * 3_600_000, now)).toBe("il y a 2 h");
    expect(timeAgo(now - 30 * 3_600_000, now)).toBe("hier");
    expect(timeAgo(now - 3 * 86_400_000, now)).toBe("il y a 3 j");
  });
});

describe("ordered", () => {
  it("puts pinned items first, then the most recent", () => {
    const list = [item(1, 10), item(2, 30), item(3, 5, true), item(4, 20)];
    expect(ordered(list).map((i) => i.id)).toEqual([3, 2, 4, 1]);
  });
});
