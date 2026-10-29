/** Lowercase, accents gone: "Éditeur" and "editeur" match. */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

const WORD_SPLIT = /[\s\-_.()[\]]+/;

/**
 * How well `name` answers `query`, 0 for not at all. In order: the whole
 * name, its start, the start of one of its words, its initials ("vsc" for
 * Visual Studio Code), anywhere inside, then its letters in order.
 */
export function score(name: string, query: string): number {
  const n = normalize(name);
  const q = normalize(query).trim();
  if (!q) return 0;
  if (n === q) return 1000;
  if (n.startsWith(q)) return 900 - (n.length - q.length);
  const words = n.split(WORD_SPLIT).filter(Boolean);
  const parts = q.split(/\s+/);
  if (parts.length > 1 && parts.every((p) => words.some((w) => w.startsWith(p)))) return 750 - n.length;
  if (words.some((w) => w.startsWith(q))) return 700 - n.length;
  if (q.length >= 2 && words.map((w) => w[0]).join("").startsWith(q)) return 600 - n.length;
  const at = n.indexOf(q);
  if (at >= 0) return 500 - at;
  if (q.length < 3) return 0;
  let found = 0;
  let gaps = 0;
  let last = -1;
  for (let i = 0; i < n.length && found < q.length; i++) {
    if (n[i] === q[found]) {
      if (last >= 0) gaps += i - last - 1;
      last = i;
      found++;
    }
  }
  return found === q.length ? Math.max(1, 300 - gaps * 10) : 0;
}

/** The best matches first; apps opened often climb a little. */
export function rank<T extends { key: string; name: string }>(
  items: T[],
  query: string,
  usage: Record<string, number> = {},
  limit = 6,
): T[] {
  return items
    .map((item) => ({ item, s: score(item.name, query) }))
    .filter(({ s }) => s > 0)
    .map(({ item, s }) => ({ item, s: s + Math.min((usage[item.key] ?? 0) * 25, 200) }))
    .sort((a, b) => b.s - a.s || a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map(({ item }) => item);
}

/** The launcher's height for `rows` results under the search bar. */
export function launcherSize(rows: number): [width: number, height: number, radius: number] {
  return [640, 58 + (rows > 0 ? 8 + rows * 42 : 0), 28];
}
