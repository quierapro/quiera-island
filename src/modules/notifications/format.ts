export interface Part {
  text: string;
  /** Set when this part is a link. */
  url?: string;
}

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/gi;
/** Punctuation that ends a sentence rather than the link. */
const TRAILING = /[.,;:!?)\]}»]+$/;

/** Splits text into plain parts and web links, so links can be clicked. */
export function splitLinks(text: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0].replace(TRAILING, "");
    const start = match.index;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: url, url });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** The time it arrived: "14:05" today, "hier 14:05", or the date. */
export function arrivedLabel(at: number, now: number, locale = "fr-FR"): string {
  const date = new Date(at);
  const time = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(new Date(now)) - day(date)) / 86_400_000);
  if (days <= 0) return time;
  if (days === 1) return `hier ${time}`;
  return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

/** The notifications panel: up to three rows show, the rest scrolls. */
export function notificationsContentSize(count: number): [width: number, height: number] {
  if (count === 0) return [380, 120];
  return [460, 38 + Math.min(count, 3) * 70];
}
