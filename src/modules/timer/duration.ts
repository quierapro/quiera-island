import { normalize } from "../launcher/search";

/** A timer the launcher offers to start. */
export interface TimerRequest {
  ms: number;
  pomodoro: boolean;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
/** Longer is not a timer any more. */
const MAX_MS = 24 * HOUR;
const POMODORO_MS = 25 * MINUTE;
/** Offered when only the word "timer" is typed. */
const SUGGESTED_MINUTES = [1, 5, 10, 15];

/** Words that ask for a timer, accents and case aside. */
const KEYWORDS = ["minuteur", "minuterie", "compte a rebours", "timer", "countdown"];

/** Units, matched as they are being typed: "m", "mi", "min" are all minutes. */
const UNITS: [ms: number, words: string[]][] = [
  [HOUR, ["heures", "hours", "hrs"]],
  [MINUTE, ["minutes", "mn", "mins"]],
  [SECOND, ["secondes", "seconds", "secs"]],
];

function unitOf(text: string): number | null {
  if (!text) return null;
  for (const [ms, words] of UNITS) if (words.some((w) => w.startsWith(text))) return ms;
  return null;
}

/**
 * "5 min", "1h30", "90s", "1,5 h": the duration in ms, or null. A number
 * without a unit follows the one before it ("1h30" is 1 h 30 min); alone,
 * it is minutes, but only after the word "timer" (`bare`): a lone number is
 * a calculation.
 */
export function parseDuration(text: string, bare = false): number | null {
  const compact = text.replace(/\s+/g, "");
  if (!compact) return null;
  const parts = [...compact.matchAll(/(\d+(?:[.,]\d+)?)([a-z]*)/g)];
  if (parts.map((p) => p[0]).join("") !== compact) return null;
  let total = 0;
  let previous: number | null = null;
  for (const [, number, unitText] of parts) {
    const value = Number(number.replace(",", "."));
    let unit = unitOf(unitText);
    if (unitText && unit === null) return null;
    if (unit === null) {
      if (previous === HOUR) unit = MINUTE;
      else if (previous === MINUTE) unit = SECOND;
      else if (bare && parts.length === 1) unit = MINUTE;
      else return null;
    }
    total += value * unit;
    previous = unit;
  }
  total = Math.round(total);
  return total > 0 && total <= MAX_MS ? total : null;
}

/**
 * The timers a launcher query asks for: "5 min", "minuteur 10", "pomodoro";
 * the word alone offers a few durations. Empty when the query is not one.
 */
export function timerRequests(query: string): TimerRequest[] {
  const q = normalize(query).trim();
  if (q.length >= 4 && "pomodoro".startsWith(q)) return [{ ms: POMODORO_MS, pomodoro: true }];
  const keyword = KEYWORDS.find((k) => q.startsWith(k));
  const rest = keyword ? q.slice(keyword.length).trim() : q;
  if (keyword && !rest) return SUGGESTED_MINUTES.map((m) => ({ ms: m * MINUTE, pomodoro: false }));
  const ms = parseDuration(rest, Boolean(keyword));
  return ms === null ? [] : [{ ms, pomodoro: false }];
}

/** "1 h 30 min", "5 min", "1 min 30 s", "45 s". */
export function formatDuration(ms: number): string {
  const total = Math.round(ms / SECOND);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h && `${h} h`, m && `${m} min`, s && `${s} s`].filter(Boolean).join(" ") || "0 s";
}

/** What is left, as a clock shows it: "4:59", "1:04:59". Rounded up, so it ends on 0:01. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / SECOND));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
