import type { CalendarEvent } from "../../ipc/calendar";
import type { Size } from "../../island/geometry";

const MINUTE = 60_000;
/** A meeting stays announced this long after it starts (time to join). */
export const LATE_MS = 5 * MINUTE;
/** Rows in the open panel, at most. */
export const AGENDA_ROWS = 6;

/** The meeting to announce: starting within `remindMs`, or started a moment ago. */
export function nextMeeting(events: readonly CalendarEvent[], now: number, remindMs: number): CalendarEvent | null {
  let best: CalendarEvent | null = null;
  for (const e of events) {
    if (e.allDay) continue;
    const until = Math.min(Math.max(e.end, e.start + MINUTE), e.start + LATE_MS);
    if (e.start - now > remindMs || now >= until) continue;
    if (!best || e.start < best.start) best = e;
  }
  return best;
}

/** Whole minutes until `start`, rounded up: 8 min 10 s is "9 min". */
export function minutesUntil(start: number, now: number): number {
  return Math.max(0, Math.ceil((start - now) / MINUTE));
}

/** The coming events: the ones not over yet, soonest first. */
export function agenda(events: readonly CalendarEvent[], now: number, rows = AGENDA_ROWS): CalendarEvent[] {
  return events.filter((e) => e.end > now || (e.end === e.start && e.start + LATE_MS > now)).slice(0, rows);
}

function dayStart(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 0 today, 1 tomorrow… in local days. */
export function daysFrom(ms: number, now: number): number {
  return Math.round((dayStart(ms) - dayStart(now)) / 86_400_000);
}

/** The agenda in days: each day's label and its events. */
export function byDay(events: readonly CalendarEvent[], now: number): { day: number; events: CalendarEvent[] }[] {
  const days: { day: number; events: CalendarEvent[] }[] = [];
  for (const e of events) {
    const day = Math.max(0, daysFrom(e.start, now));
    const last = days[days.length - 1];
    if (last?.day === day) last.events.push(e);
    else days.push({ day, events: [e] });
  }
  return days;
}

/** "10:00", in the language's way. */
export function clock(ms: number, locale?: string): string {
  return new Date(ms).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

/** The open panel: a title line per day, a row per event (as calendar.css lays them out). */
export function agendaSize(days: number, rows: number): Size {
  // Nothing coming: room for a line saying so.
  if (rows === 0) return [420, 70, 26];
  return [420, 20 + days * 22 + Math.max(0, days - 1) * 2 + rows * 46, 26];
}

/** The coming events that fit in `maxHeight`: the latest ones give way. */
export function fitAgenda(events: readonly CalendarEvent[], now: number, maxHeight: number): CalendarEvent[] {
  const list = [...events];
  while (list.length > 1 && agendaSize(byDay(list, now).length, list.length)[1] > maxHeight) list.pop();
  return list;
}
