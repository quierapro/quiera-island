import type { AgentAction, AgentDiffLine, AgentQuestion, AgentRequest, AgentSession, AgentUsage } from "../../ipc/agents";
import type { Size } from "../../island/geometry";
import type { Messages } from "../../i18n";

/** Rows in the open panel, at most. */
export const AGENT_ROWS = 5;
const ROW_HEIGHT = 50;

/** Waiting for its user: allowing something, or answering a question. */
export const needsYou = (s: AgentSession) => s.state === "waiting" || s.state === "question";
const active = (s: AgentSession) => s.state === "working" || needsYou(s);

/**
 * The session the closed island shows: one that needs its user first (the
 * one waiting longest), else the latest at work; and how many others are active.
 */
export function leadSession(sessions: readonly AgentSession[]): { session: AgentSession; more: number } | null {
  const live = sessions.filter(active);
  if (live.length === 0) return null;
  const waiting = live.filter(needsYou).sort((a, b) => a.since - b.since);
  const session = waiting[0] ?? [...live].sort((a, b) => b.since - a.since)[0];
  return { session, more: live.length - 1 };
}

/**
 * What changed worth a peek between two lists: a session that has just
 * finished, or has just started to wait. Sessions new to the list are not
 * news: the island did not see them before.
 */
export function agentNews(before: readonly AgentSession[], after: readonly AgentSession[]): { session: AgentSession; kind: "done" | "waiting" } | null {
  let news: { session: AgentSession; kind: "done" | "waiting" } | null = null;
  for (const s of after) {
    const was = before.find((b) => b.id === s.id);
    if (!was || was.state === s.state) continue;
    if (needsYou(s) && !needsYou(was)) return { session: s, kind: "waiting" };
    if (s.state === "done" && was.state !== "done") news ??= { session: s, kind: "done" };
  }
  return news;
}

/** "Modifie auth.ts", "Lance npm test", or what the state says. */
export function describe(s: AgentSession, t: Messages["agents"]): string {
  switch (s.state) {
    case "waiting": {
      // What it waits to do, when known: "Attend ton accord : Lance npm test".
      const verb = s.tool ? t.tools[s.tool] : undefined;
      return verb && s.target ? `${t.needsYou} : ${verb} ${s.target}` : t.needsYou;
    }
    case "question":
      return s.target ?? t.asks;
    case "done":
      return t.done;
    case "failed":
      return t.failed;
    case "ready":
      return t.ready;
    case "working": {
      const verb = s.tool ? t.tools[s.tool] : undefined;
      if (verb && s.target) return `${verb} ${s.target}`;
      return verb ?? t.working;
    }
  }
}

/** Whole minutes since `since`. */
export function minutesSince(since: number, now: number): number {
  return Math.max(0, Math.floor((now - since) / 60_000));
}

/** The row of usage rings at the top of the agents tab. */
export const USAGE_ROW_HEIGHT = 34;

/** Steps shown under the session in focus, at most. */
export const AGENT_STEPS = 4;
const STEP_HEIGHT = 30;

/**
 * The open panel: a row per session (those that need their user first),
 * and under the one in focus (hovered, else the first), its latest steps.
 * Steps, then rows, give way until it fits in `maxHeight`.
 */
export function agentsLayout(
  sessions: readonly AgentSession[],
  focusId: string | null,
  maxHeight: number,
  usageRow = false,
): { rows: AgentSession[]; focus: string | null; steps: number; size: Size } {
  let rows = sortSessions(sessions).slice(0, AGENT_ROWS);
  const focus = rows.find((s) => s.id === focusId) ?? rows[0] ?? null;
  let steps = Math.min(focus?.recent.length ?? 0, AGENT_STEPS);
  // The session in focus says how full its context is, above its steps.
  const contextLine = focus?.context != null ? 1 : 0;
  const details = () => steps + contextLine;
  const height = () =>
    20 + (usageRow ? USAGE_ROW_HEIGHT : 0) + Math.max(1, rows.length) * ROW_HEIGHT + (details() > 0 ? details() * STEP_HEIGHT + 6 : 0);
  while (height() > maxHeight && steps > 0) steps--;
  while (height() > maxHeight && rows.length > 1) {
    // The last row that is not the one in focus gives way.
    const drop = [...rows].reverse().find((s) => s !== focus);
    if (!drop) break;
    rows = rows.filter((s) => s !== drop);
  }
  return { rows, focus: focus?.id ?? null, steps, size: [420, height(), 26] };
}

/** What opening a step does: a file, a page, a web search, or nothing. */
export function stepKind(step: AgentAction): "file" | "page" | "search" | "command" | "other" {
  switch (step.tool) {
    case "Read":
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
    case "Write":
      return "file";
    case "WebFetch":
      return "page";
    case "WebSearch":
      return "search";
    case "Bash":
    case "PowerShell":
      return "command";
    default:
      return "other";
  }
}

/** "Lu auth.ts", "Consulté docs.rs". */
export function stepText(step: AgentAction, t: Messages["agents"]): string {
  const verb = t.steps[step.tool] ?? step.tool;
  return step.target ? `${verb} ${step.target}` : verb;
}

/** The question card: as tall as its longest list of options. */
export function questionCardSize(questions: readonly AgentQuestion[]): Size {
  const options = Math.max(1, ...questions.map((q) => q.options.length));
  return [460, 134 + options * 42, 28];
}

/** A plan to approve: room for a few of its lines. */
export const PLAN_CARD_SIZE: Size = [460, 236, 28];

/** Lines of a change shown at once (more scroll). */
export const DIFF_LINES = 9;
const DIFF_LINE_HEIGHT = 17;

/** A change to allow: the card, with room for its lines. */
export function diffCardSize(diff: readonly AgentDiffLine[]): Size {
  return [500, 122 + 24 + Math.min(diff.length, DIFF_LINES) * DIFF_LINE_HEIGHT, 28];
}

/** An agent's usage windows, the fullest first; and its fullest one. */
export function fullest(usage: AgentUsage | undefined): AgentUsage["windows"][number] | null {
  if (!usage || usage.windows.length === 0) return null;
  return usage.windows.reduce((a, b) => (b.used > a.used ? b : a));
}

/** "40 min", "2 h", "3 j": a duration in its largest unit. */
export function span(minutes: number, days: string): string {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h`;
  return `${Math.round(minutes / 1440)} ${days}`;
}

/** The pill shows the ring only when a limit nears: below, it stays out of the way. */
export const RING_IN_PILL_FROM = 75;

/** The ring's colour: calm, then orange, then red as a limit nears. */
export function usageTone(used: number): "ok" | "high" | "full" {
  return used >= 90 ? "full" : used >= 75 ? "high" : "ok";
}

/**
 * The newest session first, in the order they started: a row never moves
 * under the pointer as states change (the colour says who needs you).
 */
export function sortSessions(sessions: readonly AgentSession[]): AgentSession[] {
  return [...sessions].sort((a, b) => b.created - a.created || a.id.localeCompare(b.id));
}

/**
 * A permission, as the island asks it: what the agent wants to do, what to,
 * and for an edit, its size ("+3 −1").
 */
export function requestLine(r: AgentRequest, t: Messages["agents"]["request"]): { verb: string; what: string | null; size: string | null } {
  const size =
    r.added !== null || r.removed !== null ? [r.added ? `+${r.added}` : null, r.removed ? `−${r.removed}` : null].filter(Boolean).join(" ") || null : null;
  switch (r.tool) {
    case "Bash":
    case "PowerShell":
      return { verb: t.run, what: r.detail ?? r.target, size: null };
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      return { verb: t.edit, what: r.target, size };
    case "Write":
      return { verb: t.create, what: r.target, size };
    case "WebFetch":
      return { verb: t.open, what: r.detail ?? r.target, size: null };
    case "ExitPlanMode":
      return { verb: t.plan, what: null, size: null };
    default:
      return { verb: t.use(r.tool ?? "?"), what: r.target, size: null };
  }
}
