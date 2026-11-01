/**
 * The timer, as pure functions of the time: running until a moment, paused
 * with what is left, or ringing once it is over. Only one at a time: a new
 * one replaces it.
 */
export type Timer =
  | { phase: "running"; total: number; pomodoro: boolean; endsAt: number }
  | { phase: "paused"; total: number; pomodoro: boolean; left: number }
  | { phase: "ringing"; total: number; pomodoro: boolean };

export function started(ms: number, pomodoro: boolean, now: number): Timer {
  return { phase: "running", total: ms, pomodoro, endsAt: now + ms };
}

export function leftAt(timer: Timer, now: number): number {
  if (timer.phase === "running") return Math.max(0, timer.endsAt - now);
  if (timer.phase === "paused") return timer.left;
  return 0;
}

/** 0 → 1 as the time runs out. */
export function progressAt(timer: Timer, now: number): number {
  return timer.total > 0 ? 1 - leftAt(timer, now) / timer.total : 1;
}

export function paused(timer: Timer, now: number): Timer {
  return timer.phase === "running" ? { ...timer, phase: "paused", left: leftAt(timer, now) } : timer;
}

export function resumed(timer: Timer, now: number): Timer {
  return timer.phase === "paused"
    ? { phase: "running", total: timer.total, pomodoro: timer.pomodoro, endsAt: now + timer.left }
    : timer;
}

export function ringing(timer: Timer): Timer {
  return { phase: "ringing", total: timer.total, pomodoro: timer.pomodoro };
}
