import type { CalendarEvent } from "../../ipc/calendar";
import { openLink } from "../../ipc/notifications";
import type { Size } from "../../island/geometry";
import { localeOf, useLang, useT } from "../../i18n";
import { agenda, byDay, clock, minutesUntil } from "./format";
import { useCalendarNow } from "./store";
import "./calendar.css";

const ignore = () => {};

/** The closed island before a meeting. */
export const CALENDAR_ACTIVITY_SIZE: Size = [250, 34, 17];
/** The peek when the reminder starts. */
export const CALENDAR_PEEK_SIZE: Size = [380, 52, 24];

const SERVICES: Record<NonNullable<CalendarEvent["service"]>, string> = {
  teams: "Teams",
  meet: "Meet",
  zoom: "Zoom",
  webex: "Webex",
};

export function CalendarIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

function Join({ event, compact = false }: { event: CalendarEvent; compact?: boolean }) {
  const t = useT().calendar;
  if (!event.join) return null;
  const join = event.join;
  return (
    <button
      className={`cal-join ${compact ? "cal-join--compact" : ""}`}
      title={event.service ? SERVICES[event.service] : undefined}
      onClick={(e) => {
        e.stopPropagation();
        openLink(join).catch(ignore);
      }}
    >
      {t.join}
    </button>
  );
}

/** "in 8 min", or "Now" once it started. */
function useCountdown(event: CalendarEvent): string {
  const t = useT().calendar;
  const now = useCalendarNow();
  const minutes = minutesUntil(event.start, now);
  return minutes > 0 ? t.inMinutes(minutes) : t.now;
}

/** The closed island: the meeting, and how long until it starts. */
export function CalendarActivity({ event }: { event: CalendarEvent }) {
  const countdown = useCountdown(event);
  return (
    <div className="cal-activity">
      <CalendarIcon size={16} />
      <span className="cal-activity-title">{event.title}</span>
      <span className="cal-activity-when">{countdown}</span>
    </div>
  );
}

/** The reminder: the meeting, when, and a way in. */
export function CalendarPeek({ event }: { event: CalendarEvent }) {
  const countdown = useCountdown(event);
  return (
    <div className="cal-peek">
      <span className="cal-peek-icon">
        <CalendarIcon size={18} />
      </span>
      <span className="cal-peek-text">
        <span className="cal-peek-title">{event.title}</span>
        <span className="cal-peek-when">{countdown}</span>
      </span>
      <Join event={event} compact />
    </div>
  );
}

/** The agenda tab: the coming events by day, each with its way in. */
export function CalendarPanel({ events }: { events: readonly CalendarEvent[] }) {
  const t = useT().calendar;
  const locale = localeOf(useLang());
  const now = useCalendarNow();
  const days = byDay(agenda(events, now), now);
  if (days.length === 0) return <div className="cal-empty">{t.empty}</div>;
  const dayName = (day: number, start: number) =>
    day === 0 ? t.today : day === 1 ? t.tomorrow : new Date(start).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="cal-panel">
      {days.map(({ day, events: list }) => (
        <section key={day} className="cal-day">
          <h3 className="cal-day-name">{dayName(day, list[0].start)}</h3>
          {list.map((e) => {
            const live = e.start <= now && now < e.end;
            return (
              <div key={e.id} className={`cal-row ${live ? "cal-row--live" : ""}`}>
                <span className="cal-bar" />
                <span className="cal-time">{e.allDay ? t.allDay : clock(e.start, locale)}</span>
                <span className="cal-text">
                  <span className="cal-title">{e.title}</span>
                  {(e.location || !e.allDay) && (
                    <span className="cal-sub">{e.allDay ? e.location : `${clock(e.start, locale)} – ${clock(e.end, locale)}${e.location ? ` · ${e.location}` : ""}`}</span>
                  )}
                </span>
                <Join event={e} />
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
