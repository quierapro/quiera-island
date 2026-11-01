/** Time shown by the island when no music plays. */

/** Milliseconds until the next minute starts, so the clock ticks on time. */
export function msUntilNextMinute(now: Date): number {
  return 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds());
}

/** `locale` undefined: Windows' own format. */
export function formatClock(now: Date, locale?: string): string {
  return now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

/** "mardi 28 octobre", capitalised: "Mardi 28 octobre". */
export function formatDay(now: Date, locale?: string): string {
  const text = now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}
