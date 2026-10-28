/**
 * The island's silhouette as SVG paths (after Bloom, GPL-3.0).
 *
 * The body is a rounded rectangle; in the attached style its top is flush
 * with the screen edge and two concave flares bridge the edge into its
 * sides. The flares are separate paths so they can fade in when the birth
 * bubble meets the edge. All pieces are filled opaque inside one group whose
 * opacity gives the translucency, so overlaps never show a darker seam.
 *
 * Coordinates: x = 0 is the left end of the left flare; the body starts at
 * x = FLARE, so the silhouette is `width + 2 * FLARE` wide whether or not the
 * flares are showing.
 */

export const FLARE = 13;

export interface BodyShape {
  width: number;
  height: number;
  topRadius: number;
  bottomRadius: number;
}

/** Full width of the silhouette: the body plus room for a flare on each side. */
export function silhouetteWidth(bodyWidth: number): number {
  return bodyWidth + 2 * FLARE;
}

/** The radii actually drawn, so they always fit the body. */
export function clampRadii(s: BodyShape): { top: number; bottom: number } {
  const top = clamp(s.topRadius, 0, Math.min(s.width / 2, s.height / 2));
  const bottom = clamp(s.bottomRadius, 0, Math.min(s.width / 2, s.height - top));
  return { top, bottom };
}

export function bodyPath(s: BodyShape): string {
  const { top: t, bottom: b } = clampRadii(s);
  const l = FLARE;
  const r = FLARE + s.width;
  const h = s.height;
  return [
    `M ${n(l + t)} 0`,
    `L ${n(r - t)} 0`,
    `A ${n(t)} ${n(t)} 0 0 1 ${n(r)} ${n(t)}`,
    `L ${n(r)} ${n(h - b)}`,
    `A ${n(b)} ${n(b)} 0 0 1 ${n(r - b)} ${n(h)}`,
    `L ${n(l + b)} ${n(h)}`,
    `A ${n(b)} ${n(b)} 0 0 1 ${n(l)} ${n(h - b)}`,
    `L ${n(l)} ${n(t)}`,
    `A ${n(t)} ${n(t)} 0 0 1 ${n(l + t)} 0`,
    "Z",
  ].join(" ");
}

// The flare's handles reach further than a circle's (0.77 instead of 0.55),
// so the curve eases into the screen edge and the body's side instead of
// meeting them with a crease. Each flare overlaps the body by 1px.
const REACH = n(FLARE * 0.77);
const TUCK = n(FLARE * 0.23);

export function leftFlarePath(): string {
  return `M 0 0 C ${REACH} 0 ${FLARE} ${TUCK} ${FLARE} ${FLARE} L ${FLARE + 1} ${FLARE} L ${FLARE + 1} 0 Z`;
}

export function rightFlarePath(bodyWidth: number): string {
  const r = FLARE + bodyWidth;
  const end = silhouetteWidth(bodyWidth);
  return `M ${n(end)} 0 C ${n(end - REACH)} 0 ${n(r)} ${TUCK} ${n(r)} ${FLARE} L ${n(r - 1)} ${FLARE} L ${n(r - 1)} 0 Z`;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(v, max));
}

/** Two decimals: enough for subpixel accuracy, short enough to diff. */
function n(v: number): number {
  return Math.round(v * 100) / 100;
}
