/** The agents' sessions, shared by the island's views, and a clock for their durations. */
import { useEffect, useState, useSyncExternalStore } from "react";
import { getAgentSessions, getAgentsUsage, onAgentSessions, onAgentsUsage, type AgentSession, type AgentUsage } from "../../ipc/agents";

let sessions: AgentSession[] = [];
let usage: AgentUsage[] = [];
let started = false;
const listeners = new Set<() => void>();

function publish(next: AgentSession[]) {
  sessions = next;
  for (const l of listeners) l();
}

export function startAgents(): void {
  if (started) return;
  started = true;
  // Listen first, then ask: an update between the two is not missed.
  onAgentSessions(publish)
    .then(() => getAgentSessions())
    .then(publish)
    .catch(() => {});
  const publishUsage = (next: AgentUsage[]) => {
    usage = next;
    for (const l of listeners) l();
  };
  onAgentsUsage(publishUsage)
    .then(() => getAgentsUsage())
    .then(publishUsage)
    .catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAgentSessions(): AgentSession[] {
  return useSyncExternalStore(subscribe, () => sessions);
}

/** How much of each AI's usage limits is used, as last heard. */
export function useAgentsUsage(): AgentUsage[] {
  return useSyncExternalStore(subscribe, () => usage);
}

/** The time, every 10 seconds: enough for minutes of work. */
export function useAgentsNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
