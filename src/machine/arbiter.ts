/**
 * Picks which live activity (music playing, timer running…) owns the island.
 * One rule instead of conditions spread across the UI: highest priority wins,
 * and among equals the most recently set one.
 */
export interface Activity {
  id: string;
  /** Higher wins. */
  priority: number;
}

/** Activities ranked from the one that owns the island to the least important. */
export function rankActivities(activities: readonly Activity[]): Activity[] {
  // Later entries were set more recently; a stable sort on reversed input
  // puts the most recent first among equal priorities.
  return [...activities].reverse().sort((a, b) => b.priority - a.priority);
}

export function primaryActivity(activities: readonly Activity[]): Activity | null {
  return rankActivities(activities)[0] ?? null;
}

/** The runner-up, shown as a small bubble beside the pill. */
export function secondaryActivity(activities: readonly Activity[]): Activity | null {
  return rankActivities(activities)[1] ?? null;
}
