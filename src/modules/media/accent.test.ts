import { describe, expect, it } from "vitest";
import { accentFromRgb, dominantColor, NEUTRAL_ACCENT, rgbToHsl } from "./accent";

describe("rgbToHsl", () => {
  it("converts primaries", () => {
    expect(rgbToHsl(255, 0, 0)).toEqual([0, 1, 0.5]);
    expect(rgbToHsl(0, 255, 0)[0]).toBe(120);
    expect(rgbToHsl(0, 0, 255)[0]).toBe(240);
  });

  it("gives greys no saturation", () => {
    expect(rgbToHsl(128, 128, 128)[1]).toBe(0);
  });
});

describe("accentFromRgb", () => {
  it("stays neutral for a grey cover", () => {
    expect(accentFromRgb(90, 92, 95)).toBe(NEUTRAL_ACCENT);
  });

  it("lifts a dark colour so it reads on black", () => {
    expect(accentFromRgb(90, 10, 20)).toBe("hsl(353 75% 64%)");
  });

  it("tones a neon colour down", () => {
    expect(accentFromRgb(0, 255, 0)).toBe("hsl(120 75% 64%)");
  });
});

describe("dominantColor", () => {
  const px = (...rgba: number[][]) => new Uint8ClampedArray(rgba.flat());

  it("ignores near-black, near-white and transparent pixels", () => {
    const rgb = dominantColor(px([0, 0, 0, 255], [255, 255, 255, 255], [200, 30, 30, 0], [30, 60, 200, 255]));
    expect(rgb).toEqual([30, 60, 200]);
  });

  it("is null when nothing colourful is left", () => {
    expect(dominantColor(px([0, 0, 0, 255], [255, 255, 255, 255]))).toBeNull();
  });
});
