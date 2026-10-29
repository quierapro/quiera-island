/** Apps shown before the list scrolls. */
export const VISIBLE_APPS = 3;

/** The controls panel: toggles, outputs, master volume, then the apps. */
export function controlsContentSize(apps: number): [width: number, height: number] {
  const rows = Math.min(apps, VISIBLE_APPS);
  return [460, 152 + (rows > 0 ? 22 + rows * 34 : 0)];
}

/**
 * While the user moves a slider, the value read from the system lags
 * behind: the local one wins until `holdMs` after the last move.
 */
export function shownLevel(system: number, local: { level: number; at: number } | undefined, now: number, holdMs = 1200): number {
  return local && now - local.at < holdMs ? local.level : system;
}
