import { APPS, FILES, type LaunchItem, type LaunchKind } from "./data";

/** Lower case without accents: « Vidéos » finds « videos ». Keeps the length of precomposed text. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export type LaunchRow =
  | { type: "item"; item: LaunchItem; match: [number, number] | null }
  | { type: "calc"; expr: string; value: string }
  | { type: "settings" }
  | { type: "web"; query: string };

/** A first word that lists one kind of file (src-tauri/src/files.rs, kind_word). */
const KIND_WORDS: Record<string, LaunchKind> = {};
for (const w of ["image", "images", "img", "photo", "photos", "capture", "captures", "screenshot", "screenshots"]) KIND_WORDS[w] = "image";
for (const w of ["video", "videos", "film", "films", "clip", "clips"]) KIND_WORDS[w] = "video";
for (const w of ["musique", "musiques", "audio", "son", "sons", "music"]) KIND_WORDS[w] = "music";
for (const w of ["document", "documents", "doc", "docs"]) KIND_WORDS[w] = "document";

const SETTINGS_WORDS = ["reglages", "parametres", "settings", "preferences", "quiera"];

/** As in the app (src/modules/launcher/results.ts). */
const MAX_ROWS = 7;
const MAX_APPS = 3;

function matchAt(item: LaunchItem, term: string): [number, number] | null {
  if (!term) return null;
  const at = fold(item.title).indexOf(term);
  return at < 0 ? null : [at, at + term.length];
}

/** Earlier matches first, a match at a word's start before one inside a word. */
function rank(item: LaunchItem, term: string): number {
  const title = fold(item.title);
  const at = title.indexOf(term);
  if (at === 0) return 0;
  if (/[\s\-_.]/.test(title[at - 1] ?? "")) return 1;
  return 2;
}

/** Settings, a calculation, the best apps, then files, and always a web search last. */
export function search(query: string): LaunchRow[] {
  const q = fold(query.trim());
  if (!q) return [];
  const rows: LaunchRow[] = [];

  if (q.length >= 3 && SETTINGS_WORDS.some((w) => w.startsWith(q) || q.startsWith(w))) rows.push({ type: "settings" });
  const value = calculate(query);
  if (value !== null) rows.push({ type: "calc", expr: query.trim(), value: formatNumber(value) });

  const [first, ...rest] = q.split(/\s+/);
  const kind = KIND_WORDS[first];
  if (!kind) {
    const apps = APPS.filter((a) => fold(a.title).includes(q)).sort((a, b) => rank(a, q) - rank(b, q));
    for (const item of apps.slice(0, MAX_APPS)) rows.push({ type: "item", item, match: matchAt(item, q) });
  }
  // "images" alone: the latest images; "vidéo maths": videos named so.
  const term = kind ? rest.join(" ") : q;
  const files = FILES.filter((f) => (!kind || f.kind === kind) && fold(f.title).includes(term)).sort((a, b) => rank(a, term) - rank(b, term));
  for (const item of files.slice(0, Math.max(MAX_ROWS - 1 - rows.length, 0))) rows.push({ type: "item", item, match: matchAt(item, term) });

  rows.push({ type: "web", query: query.trim() });
  return rows;
}

/** The launcher's height for so many rows (src/modules/launcher/search.ts). */
export function launcherHeight(rows: number): number {
  return 58 + (rows > 0 ? 8 + rows * 42 : 0);
}

export function formatNumber(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 10 });
}

/**
 * A small calculator: + − × ÷ ^ %, parentheses, decimal comma or point.
 * Null unless the text is a calculation with at least one operator.
 */
export function calculate(text: string): number | null {
  const src = text.replace(/\s+/g, "").replace(/,/g, ".").replace(/[x×]/g, "*").replace(/÷/g, "/");
  if (!/^[\d.+\-*/^()%]+$/.test(src) || !/\d/.test(src) || !/[+\-*/^%]/.test(src.replace(/^-/, ""))) return null;
  let i = 0;
  const peek = () => src[i];
  const number = (): number => {
    const m = /^\d*\.?\d+|^\d+\.?/.exec(src.slice(i));
    if (!m) throw new Error("number");
    i += m[0].length;
    return parseFloat(m[0]);
  };
  const atom = (): number => {
    if (peek() === "-") {
      i++;
      return -atom();
    }
    if (peek() === "(") {
      i++;
      const v = sum();
      if (peek() !== ")") throw new Error("paren");
      i++;
      return v;
    }
    let v = number();
    if (peek() === "%") {
      i++;
      v /= 100;
    }
    return v;
  };
  const power = (): number => {
    const base = atom();
    if (peek() === "^") {
      i++;
      return Math.pow(base, power());
    }
    return base;
  };
  const product = (): number => {
    let v = power();
    while (peek() === "*" || peek() === "/") {
      const op = src[i++];
      const r = power();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  };
  const sum = (): number => {
    let v = product();
    while (peek() === "+" || peek() === "-") {
      const op = src[i++];
      const r = product();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };
  try {
    const v = sum();
    if (i !== src.length || !Number.isFinite(v)) return null;
    return Math.round(v * 1e10) / 1e10;
  } catch {
    return null;
  }
}
