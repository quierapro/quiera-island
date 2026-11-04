/** The coming events, shared by the island's views, and a clock for their countdowns. */
import { useEffect, useState, useSyncExternalStore } from "react";
import { getCalendarEvents, onCalendarEvents, type CalendarEvent } from "../../ipc/calendar";
import { nextMeeting } from "./format";

let events: CalendarEvent[] = [];
let started = false;
const listeners = new Set<() => void>();

function publish(next: CalendarEvent[]) {
  events = next;
  for (const l of listeners) l();
}

export function startCalendar(): void {
  if (started) return;
  started = true;
  // Listen first, then ask: an update between the two is not missed.
  onCalendarEvents(publish)
    .then(() => getCalendarEvents())
    .then(publish)
    .catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCalendarEvents(): CalendarEvent[] {
  return useSyncExternalStore(subscribe, () => events);
}

/**
 * The meeting to announce, checked every 15 seconds. The island renders
 * again only when it changes, not at every check.
 */
export function useNextMeeting(remindMs: number): CalendarEvent | null {
  const list = useCalendarEvents();
  const [meeting, setMeeting] = useState<CalendarEvent | null>(() => nextMeeting(list, Date.now(), remindMs));
  useEffect(() => {
    const check = () =>
      setMeeting((previous) => {
        const next = nextMeeting(list, Date.now(), remindMs);
        const same = next && previous && next.id === previous.id && next.title === previous.title && next.join === previous.join;
        return same ? previous : next;
      });
    check();
    const timer = setInterval(check, 15_000);
    return () => clearInterval(timer);
  }, [list, remindMs]);
  return meeting;
}

/** The time, every 15 seconds: enough for minutes counting down. */
export function useCalendarNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
