import type { FileHit, LauncherApp } from "../../ipc/launcher";
import { calculate } from "./calc";
import { rank } from "./search";

export type Result =
  | { kind: "calc"; id: string; value: number }
  | { kind: "app"; id: string; app: LauncherApp }
  | { kind: "file"; id: string; file: FileHit }
  | { kind: "web"; id: string; query: string };

/** What fits in the window under the search bar. */
export const MAX_ROWS = 7;
/** Apps shown at most, so files keep room. */
const MAX_APPS = 3;

/**
 * The list under the search bar: a calculation when the text is one, the
 * best apps, then files, and always a web search last.
 */
export function compose(query: string, apps: LauncherApp[], files: FileHit[], usage: Record<string, number>): Result[] {
  const q = query.trim();
  if (!q) return [];
  const list: Result[] = [];
  const value = calculate(q);
  if (value !== null) list.push({ kind: "calc", id: "calc", value });
  for (const app of rank(apps, q, usage, MAX_APPS)) list.push({ kind: "app", id: `app:${app.key}`, app });
  const room = MAX_ROWS - 1 - list.length;
  for (const file of files.slice(0, Math.max(room, 0))) {
    list.push({ kind: "file", id: `file:${file.generation}:${file.id}`, file });
  }
  list.push({ kind: "web", id: "web", query: q });
  return list;
}
