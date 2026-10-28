import { describe, expect, it } from "vitest";
import { primaryActivity, rankActivities, secondaryActivity } from "./arbiter";

const media = { id: "media", priority: 10 };
const timer = { id: "timer", priority: 20 };
const download = { id: "download", priority: 10 };

describe("arbiter", () => {
  it("has nothing to show without activities", () => {
    expect(primaryActivity([])).toBeNull();
    expect(secondaryActivity([])).toBeNull();
  });

  it("gives the island to the highest priority", () => {
    expect(primaryActivity([media, timer])?.id).toBe("timer");
    expect(secondaryActivity([media, timer])?.id).toBe("media");
  });

  it("prefers the most recent activity among equal priorities", () => {
    expect(primaryActivity([media, download])?.id).toBe("download");
    expect(primaryActivity([download, media])?.id).toBe("media");
  });

  it("does not modify its input", () => {
    const input = [media, timer];
    rankActivities(input);
    expect(input).toEqual([media, timer]);
  });
});
