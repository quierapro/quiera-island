/** Time shown by the island when no music plays. */

/** Milliseconds until the next minute starts, so the clock ticks on time. */
export function msUntilNextMinute(now: Date): number {
  return 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds());
}

const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" });

export function formatClock(now: Date): string {
  return time.format(now);
}

/** "mardi 28 octobre", capitalised: "Mardi 28 octobre". */
export function formatDay(now: Date): string {
  const text = day.format(now);
  return text.charAt(0).toUpperCase() + text.slice(1);
}
