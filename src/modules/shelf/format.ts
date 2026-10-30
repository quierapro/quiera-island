/** "2,4 Mo", "402 Ko", "3 o": sizes the way the user's locale writes them. */
export function formatSize(bytes: number, locale?: string): string {
  const units = ["o", "Ko", "Mo", "Go", "To"];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toLocaleString(locale, { maximumFractionDigits: digits })} ${units[unit]}`;
}

/**
 * The size of the shelf panel's content for `count` items: one row of
 * tiles, or a smaller drop zone when empty.
 */
export function shelfContentSize(count: number): [width: number, height: number] {
  return count === 0 ? [380, 120] : [560, 150];
}

/** "9:05": minutes and seconds left. */
export function countdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
