import type { ClipItem } from "../../ipc/clipboard";

/** "à l'instant", "il y a 5 min", "il y a 2 h", "hier", "il y a 3 j". */
export function timeAgo(then: number, now: number): string {
  const minutes = Math.floor((now - then) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "hier" : `il y a ${days} j`;
}

/** Pinned items first, then the most recent. */
export function ordered(items: ClipItem[]): ClipItem[] {
  return [...items].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.copiedAt - a.copiedAt);
}

/** The clipboard panel's content: one row of cards, like the shelf. */
export function clipboardContentSize(count: number): [width: number, height: number] {
  return count === 0 ? [380, 120] : [560, 150];
}
