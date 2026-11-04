import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** Mirrors `Event` in `src-tauri/src/calendar.rs`. */
export interface CalendarEvent {
  id: string;
  title: string;
  /** Milliseconds since 1970. */
  start: number;
  end: number;
  allDay: boolean;
  location: string;
  /** The meeting's link, when it has one. */
  join: string | null;
  service: "teams" | "meet" | "zoom" | "webex" | null;
}

/** What reading a link found, before it is added. */
export interface LinkCheck {
  name: string | null;
  upcoming: number;
}

export const getCalendarEvents = () => invoke<CalendarEvent[]>("calendar_events");
export const refreshCalendar = () => invoke<void>("calendar_refresh");
export const checkCalendarLink = (link: string) => invoke<LinkCheck>("calendar_check", { link });

export function onCalendarEvents(callback: (events: CalendarEvent[]) => void): Promise<UnlistenFn> {
  return listen<CalendarEvent[]>("calendar://events", (event) => callback(event.payload));
}
