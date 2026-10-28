import { describe, expect, it } from "vitest";
import type { MediaState } from "../../ipc/media";
import { formatRemaining, formatTime, mediaDecision, positionAt, trackKey } from "./progress";

const track = (over: Partial<MediaState> = {}): MediaState => ({
  appId: "Spotify.exe",
  title: "Song",
  artist: "Artist",
  album: "",
  playing: true,
  positionMs: 42_000,
  durationMs: 180_000,
  positionAt: 1_000_000,
  canSeek: true,
  canPrevious: true,
  canNext: true,
  canPlayPause: true,
  shuffle: false,
  repeat: "none",
  canShuffle: true,
  canRepeat: true,
  artwork: null,
  ...over,
});

describe("positionAt", () => {
  it("moves on with the clock while playing", () => {
    expect(positionAt(track(), 1_000_000 + 1500)).toBe(43_500);
  });

  it("stays put while paused", () => {
    expect(positionAt(track({ playing: false }), 1_000_000 + 60_000)).toBe(42_000);
  });

  it("never passes the end of the track", () => {
    expect(positionAt(track(), 1_000_000 + 10 * 60_000)).toBe(180_000);
  });

  it("never goes back when the clock is behind the report", () => {
    expect(positionAt(track(), 1_000_000 - 5000)).toBe(42_000);
  });

  it("is null when the app publishes no timeline", () => {
    expect(positionAt(track({ positionMs: null, durationMs: null }), 0)).toBeNull();
  });
});

describe("formatting", () => {
  it("formats minutes and seconds", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(65_400)).toBe("1:05");
    expect(formatTime(3_725_000)).toBe("1:02:05");
  });

  it("formats the time left", () => {
    expect(formatRemaining(42_000, 180_000)).toBe("-2:18");
    expect(formatRemaining(200_000, 180_000)).toBe("-0:00");
  });
});

describe("mediaDecision", () => {
  it("shows the activity while a track plays", () => {
    expect(mediaDecision(null, track()).live).toBe(true);
    expect(mediaDecision(null, track({ playing: false })).live).toBe(false);
  });

  it("does not count a session without metadata", () => {
    expect(trackKey(track({ title: "", artist: "" }))).toBeNull();
    expect(mediaDecision(null, track({ title: "", artist: "" })).live).toBe(false);
  });

  it("announces a new track, but not one already playing at startup", () => {
    expect(mediaDecision(undefined, track()).peek).toBe(false);
    expect(mediaDecision(null, track()).peek).toBe(true);
    expect(mediaDecision(track({ title: "Before" }), track()).peek).toBe(true);
  });

  it("does not announce the same track again on pause, resume or position updates", () => {
    expect(mediaDecision(track({ playing: false }), track()).peek).toBe(false);
    expect(mediaDecision(track({ positionMs: 1 }), track()).peek).toBe(false);
  });
});
