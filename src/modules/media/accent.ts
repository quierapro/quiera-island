/**
 * The accent colour drawn from the cover art: the island stays neutral and
 * the colour comes from the content (docs/02 §3.3). Saturation and lightness
 * are bounded so the accent reads on black and never shouts.
 */

/** Used when the cover is grey or missing. */
export const NEUTRAL_ACCENT = "#ffffff";

export function accentFromRgb(r: number, g: number, b: number): string {
  const [h, s] = rgbToHsl(r, g, b);
  if (s < 0.15) return NEUTRAL_ACCENT;
  const sat = Math.min(0.75, Math.max(0.35, s));
  const light = 0.64;
  return `hsl(${Math.round(h)} ${Math.round(sat * 100)}% ${Math.round(light * 100)}%)`;
}

export function rgbToHsl(r: number, g: number, b: number): [h: number, s: number, l: number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

/**
 * Average of the cover's colourful pixels (near-black and near-white ones
 * say little about the cover's colour), weighted by saturation.
 */
export function dominantColor(pixels: Uint8ClampedArray): [number, number, number] | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let weight = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const [, s, l] = rgbToHsl(pixels[i], pixels[i + 1], pixels[i + 2]);
    if (l < 0.08 || l > 0.95) continue;
    const w = 0.05 + s;
    r += pixels[i] * w;
    g += pixels[i + 1] * w;
    b += pixels[i + 2] * w;
    weight += w;
  }
  return weight === 0 ? null : [r / weight, g / weight, b / weight];
}

/** Loads the cover and computes its accent; neutral on any failure. */
export function extractAccent(url: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 24;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(NEUTRAL_ACCENT);
        ctx.drawImage(img, 0, 0, size, size);
        const rgb = dominantColor(ctx.getImageData(0, 0, size, size).data);
        resolve(rgb ? accentFromRgb(...rgb) : NEUTRAL_ACCENT);
      } catch {
        resolve(NEUTRAL_ACCENT);
      }
    };
    img.onerror = () => resolve(NEUTRAL_ACCENT);
    img.src = url;
  });
}
