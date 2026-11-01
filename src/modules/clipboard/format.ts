import type { ClipItem } from "../../ipc/clipboard";
import { fr } from "../../i18n/fr";

/** "à l'instant", "il y a 5 min", "il y a 2 h", "hier", "il y a 3 j" (in the language of `t`). */
export function timeAgo(then: number, now: number, t = fr.time): string {
  const minutes = Math.floor((now - then) / 60_000);
  if (minutes < 1) return t.justNow;
  if (minutes < 60) return t.minutesAgo(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t.hoursAgo(hours);
  const days = Math.floor(hours / 24);
  return days === 1 ? t.yesterday : t.daysAgo(days);
}

/** Pinned items first, then the most recent. */
export function ordered(items: ClipItem[]): ClipItem[] {
  return [...items].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.copiedAt - a.copiedAt);
}

/** The clipboard panel's content: one row of cards, like the shelf. */
export function clipboardContentSize(count: number): [width: number, height: number] {
  return count === 0 ? [380, 120] : [560, 150];
}
