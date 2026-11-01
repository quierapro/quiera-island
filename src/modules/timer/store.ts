/**
 * The running timer, shared by the launcher (which starts it) and the
 * island (which shows it). It rings at its end, then goes away by itself
 * if nobody answers.
 */
import { useSyncExternalStore } from "react";
import { ring } from "./chime";
import { paused, resumed, ringing, started, type Timer } from "./state";

/** A ringing timer nobody answers leaves after this long. */
const RING_FOR_MS = 60_000;

let timer: Timer | null = null;
let alarm: ReturnType<typeof setTimeout> | null = null;
let silence: (() => void) | null = null;
const listeners = new Set<() => void>();

function set(next: Timer | null) {
  if (alarm) clearTimeout(alarm);
  alarm = null;
  silence?.();
  silence = null;
  timer = next;
  if (next?.phase === "running") {
    alarm = setTimeout(() => {
      if (timer) set(ringing(timer));
    }, next.endsAt - Date.now());
  } else if (next?.phase === "ringing") {
    silence = ring();
    alarm = setTimeout(() => set(null), RING_FOR_MS);
  }
  for (const l of listeners) l();
}

export function startTimer(ms: number, pomodoro: boolean): void {
  set(started(ms, pomodoro, Date.now()));
}

export function pauseTimer(): void {
  if (timer) set(paused(timer, Date.now()));
}

export function resumeTimer(): void {
  if (timer) set(resumed(timer, Date.now()));
}

/** The same duration, from the start. */
export function restartTimer(): void {
  if (timer) set(started(timer.total, timer.pomodoro, Date.now()));
}

export function stopTimer(): void {
  set(null);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTimer(): Timer | null {
  return useSyncExternalStore(subscribe, () => timer);
}
