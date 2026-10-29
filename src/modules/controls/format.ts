/** Rows the lower list shows before it scrolls. */
export const VISIBLE_ROWS = 3;
/** One app (or output) row and the gap after it. */
const ROW = 34;
const GAP = 6;

/**
 * The controls panel: toggles, the output button and the master volume,
 * then the apps, or the outputs while their list is unfolded.
 */
export function controlsContentSize(apps: number, outputsOpen = false): [width: number, height: number] {
  const base = 158;
  const rows = outputsOpen ? VISIBLE_ROWS : Math.min(apps, VISIBLE_ROWS);
  if (rows === 0) return [460, base];
  // Gap, caption, gap, then the rows.
  return [460, base + 10 + 14 + 6 + rows * ROW + (rows - 1) * GAP];
}

/**
 * While the user moves a slider, the value read from the system lags
 * behind: the local one wins until `holdMs` after the last move.
 */
export function shownLevel(system: number, local: { level: number; at: number } | undefined, now: number, holdMs = 1200): number {
  return local && now - local.at < holdMs ? local.level : system;
}

/** A pointer's position on a slider as a level, 0–100. */
export function levelAt(x: number, left: number, width: number): number {
  if (width <= 0) return 0;
  return Math.round(Math.min(Math.max((x - left) / width, 0), 1) * 100);
}
