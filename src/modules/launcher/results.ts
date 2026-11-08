import type { FileHit, LauncherApp } from "../../ipc/launcher";
import { timerRequests } from "../timer/duration";
import { calculate } from "./calc";
import { normalize, rank } from "./search";

export type Result =
  | { kind: "timer"; id: string; ms: number; pomodoro: boolean }
  | { kind: "calc"; id: string; value: number }
  | { kind: "app"; id: string; app: LauncherApp }
  | { kind: "file"; id: string; file: FileHit }
  | { kind: "web"; id: string; query: string }
  | { kind: "agent"; id: string; agent: "claude" | "codex"; task: string }
  | { kind: "settings"; id: string };

/** Words that open Quiera's own settings. */
const SETTINGS_WORDS = ["reglages", "parametres", "settings", "preferences", "quiera"];

/** Whether the query asks for Quiera's settings ("régl", "paramètres"…). */
export function asksForSettings(query: string): boolean {
  const q = normalize(query).trim();
  return q.length >= 3 && SETTINGS_WORDS.some((word) => word.startsWith(q) || q.startsWith(word));
}

/**
 * "claude fix the tests", "codex: write the docs": a task for an agent,
 * started in a new terminal.
 */
export function agentRequest(query: string): { agent: "claude" | "codex"; task: string } | null {
  const match = /^\s*(claude|codex)\b[\s:,]+(.+)$/i.exec(query);
  if (!match) return null;
  const task = match[2].trim();
  return task ? { agent: match[1].toLowerCase() as "claude" | "codex", task } : null;
}

/** What fits in the window under the search bar. */
export const MAX_ROWS = 7;
/** Apps shown at most, so files keep room. */
const MAX_APPS = 3;

/**
 * The list under the search bar: a timer or a calculation when the text is
 * one, the best apps, then files, and always a web search last.
 */
export function compose(query: string, apps: LauncherApp[], files: FileHit[], usage: Record<string, number>): Result[] {
  const q = query.trim();
  if (!q) return [];
  const list: Result[] = [];
  const asked = agentRequest(q);
  if (asked) list.push({ kind: "agent", id: `agent:${asked.agent}`, ...asked });
  if (asksForSettings(q)) list.push({ kind: "settings", id: "settings" });
  for (const { ms, pomodoro } of timerRequests(q)) list.push({ kind: "timer", id: `timer:${ms}:${pomodoro}`, ms, pomodoro });
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
