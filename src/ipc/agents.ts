import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { PhoneLink } from "./shelf";

export type AgentState = "ready" | "working" | "waiting" | "question" | "done" | "failed";

/** A question Claude asks, with its options. Mirrors `Question` in `src-tauri/src/agents.rs`. */
export interface AgentQuestion {
  question: string;
  header?: string;
  multiSelect: boolean;
  options: { label: string; description?: string }[];
}

/** One step of a session. Mirrors `Action` in `src-tauri/src/agents.rs`. */
export interface AgentAction {
  tool: string;
  target: string | null;
  /** What it opens: a file's path, an address, a search. */
  link: string | null;
  failed: boolean;
  at: number;
}

/** One line of a change: "-" removed, "+" added, " " around. Mirrors `DiffLine` in `src-tauri/src/agents.rs`. */
export interface AgentDiffLine {
  kind: "-" | "+" | " ";
  text: string;
}

/** One usage limit of an AI: its length, how much is used. Mirrors `UsageWindow` in `src-tauri/src/agents.rs`. */
export interface AgentUsageWindow {
  /** 300: five hours; 10080: a week. */
  minutes: number;
  /** 0 to 100 (above once exceeded). */
  used: number;
  /** Seconds since 1970. */
  resetsAt: number | null;
  /** At the current pace, minutes until it is reached (before it resets). */
  fullIn?: number;
}

/** Mirrors `Usage` in `src-tauri/src/agents.rs`. */
export interface AgentUsage {
  agent: string;
  windows: AgentUsageWindow[];
  /** When it was last heard (ms since 1970). */
  updated: number;
}

/** A permission asked, the agent waiting for the island's answer. Mirrors `Request` in `src-tauri/src/agents.rs`. */
export interface AgentRequest {
  id: number;
  tool: string | null;
  target: string | null;
  /** The whole command, or the address. */
  detail: string | null;
  /** For an edit: lines added and removed. */
  added: number | null;
  removed: number | null;
  /** A question to answer by picking options, instead of allowing. */
  questions: AgentQuestion[] | null;
  /** For a change to a file: its lines, removed and added. */
  diff: AgentDiffLine[] | null;
  /** "Always allow" is offered (the agent's own suggestion). */
  always: boolean;
  /** A command that destroys or rewrites: allowed only by a held press. */
  danger: boolean;
}

export type AgentDecision = "allow" | "deny" | "terminal";

/** Mirrors `Session` in `src-tauri/src/agents.rs`. */
export interface AgentSession {
  id: string;
  /** "claude". */
  agent: string;
  /** The project's folder name. */
  project: string;
  state: AgentState;
  /** The tool it last used: "Edit", "Bash"… */
  tool: string | null;
  /** What that tool works on: a file's name, a command, a question. */
  target: string | null;
  /** Since when (ms since 1970) it is in this state, or working on this turn. */
  since: number;
  request: AgentRequest | null;
  /** Whether a click can bring its window (terminal, editor) back. */
  canFocus: boolean;
  /** Its latest steps, newest first. */
  recent: AgentAction[];
  /** When it was first heard from (ms since 1970): the list keeps this order. */
  created: number;
  /** How full its context window is (0-100). */
  context: number | null;
}

/** Mirrors `Status` in `src-tauri/src/agents.rs`. */
export type HookStatus = "on" | "off" | "missing" | "unreadable";

export interface AgentsStatus {
  claude: HookStatus;
  codex: HookStatus;
}

export const getAgentSessions = () => invoke<AgentSession[]>("agents_sessions");
export const getAgentsStatus = () => invoke<AgentsStatus>("agents_status");
export const connectClaude = (on: boolean) => invoke<AgentsStatus>("agents_connect", { on, agent: "claude" });
export const connectAgent = (agent: "claude" | "codex", on: boolean) => invoke<AgentsStatus>("agents_connect", { on, agent });
/** Starts an agent on a task, in a new terminal. */
export const launchAgent = (agent: "claude" | "codex", task: string) => invoke<void>("agents_launch", { agent, task });
/** A sound for an agent's news (the backend checks the setting and Do Not Disturb). */
export const agentSound = (kind: "done" | "waiting") => invoke<void>("agents_sound", { kind });
/** Links a phone to answer the agents from (a QR code to its page), or unlinks it. */
export const startAgentsPhone = () => invoke<PhoneLink>("agents_phone_start");
export const stopAgentsPhone = () => invoke<void>("agents_phone_stop");
/** Gives the island the keyboard (an answer to type), or gives it back. */
export const agentKeyboard = (take: boolean) => invoke<void>("agents_keyboard", { take });
/** One question's answer: options picked by position, or typed text. */
export type AgentPick = number[] | string;

/**
 * `picked`: for a question, one answer per question. `always`: stop asking
 * for this, as the agent suggested.
 */
export const decideAgent = (id: number, decision: AgentDecision, picked?: AgentPick[], always = false) =>
  invoke<boolean>("agents_decide", { id, decision, picked: picked ?? null, always });
/** Opens what a session's step worked on: its file, its page, its search. */
export const openAgentStep = (session: string, index: number) => invoke<void>("agents_open", { session, index });
export const focusAgent = (id: string) => invoke<boolean>("agents_focus", { id });

/** Claude Code has started and Quiera does not listen to it yet. */
export function onAgentsOffer(callback: () => void): Promise<UnlistenFn> {
  return listen<string>("agents://offer", () => callback());
}

export const getAgentsUsage = () => invoke<AgentUsage[]>("agents_usage");

export function onAgentsUsage(callback: (usage: AgentUsage[]) => void): Promise<UnlistenFn> {
  return listen<AgentUsage[]>("agents://usage", (event) => callback(event.payload));
}

export function onAgentSessions(callback: (sessions: AgentSession[]) => void): Promise<UnlistenFn> {
  return listen<AgentSession[]>("agents://sessions", (event) => callback(event.payload));
}
