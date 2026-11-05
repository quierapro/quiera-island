/**
 * The island's newer views, rebuilt for the page from the app's
 * (src/modules/timer, calendar, mirror, media): same sizes, same looks.
 */
import { useEffect, useRef } from "react";
import { useTr } from "../i18n";
import type { DemoEvent } from "./data";
import type { Size } from "./views";

/* ---------------------------------------------------------------- Timer */

export const TIMER_ACTIVITY: Size = [156, 34, 17];
export const timerPanelSize = (running: boolean): Size => (running ? [380, 92, 28] : [380, 124, 28]);

export function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function TimerIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 13.5V9.5M9.5 3h5M18.5 6.5l1.2-1.2" />
    </svg>
  );
}

function Ring({ progress, size }: { progress: number; size: number }) {
  const r = size / 2 - 2;
  const length = 2 * Math.PI * r;
  return (
    <svg className="timer-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle className="timer-ring-track" cx={size / 2} cy={size / 2} r={r} />
      <circle
        className="timer-ring-left"
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeDasharray={length}
        strokeDashoffset={length * progress}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export type TimerPhase = "running" | "paused" | "ringing";

export function TimerActivity({ left, total, phase }: { left: number; total: number; phase: TimerPhase }) {
  const tr = useTr();
  if (phase === "ringing") {
    return (
      <div className="timer-activity timer-activity--ringing">
        <span className="timer-bell">
          <TimerIcon size={16} />
        </span>
        <span className="timer-activity-time">{tr("Terminé", "Time's up")}</span>
      </div>
    );
  }
  return (
    <div className={`timer-activity ${phase === "paused" ? "timer-activity--paused" : ""}`}>
      <Ring progress={total ? 1 - left / total : 1} size={18} />
      <span className="timer-activity-time">{countdown(left)}</span>
    </div>
  );
}

const PauseGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="6" y="4.5" width="4.2" height="15" rx="1.4" />
    <rect x="13.8" y="4.5" width="4.2" height="15" rx="1.4" />
  </svg>
);
const PlayGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M7.5 5.2v13.6c0 .9 1 1.4 1.7.9l10-6.8a1.1 1.1 0 0 0 0-1.8l-10-6.8c-.7-.5-1.7 0-1.7.9Z" />
  </svg>
);
const CloseGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </svg>
);
const RepeatGlyph = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4.5H9" />
  </svg>
);

/** The timer's tab while one runs: two round buttons and the countdown, as on iPhone. */
export function TimerLive({
  left,
  phase,
  pomodoro,
  onStop,
  onMain,
}: {
  left: number;
  phase: TimerPhase;
  pomodoro: boolean;
  onStop(): void;
  onMain(): void;
}) {
  const tr = useTr();
  const name = pomodoro ? "Pomodoro" : tr("Minuteur", "Timer");
  const ringing = phase === "ringing";
  const main = ringing ? [tr("Répéter", "Repeat"), <RepeatGlyph key="r" />] : phase === "paused" ? [tr("Reprendre", "Resume"), <PlayGlyph key="p" />] : [tr("Pause", "Pause"), <PauseGlyph key="z" />];
  const press = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  return (
    <div className={`timer-live ${ringing ? "timer-live--ringing" : ""} ${phase === "paused" ? "timer-live--paused" : ""}`}>
      <div className="timer-live-buttons">
        <button type="button" className="timer-circle timer-circle--gray" aria-label={tr("Arrêter", "Stop")} onClick={press(onStop)}>
          <CloseGlyph />
        </button>
        <button type="button" className="timer-circle timer-circle--orange" aria-label={main[0] as string} onClick={press(onMain)}>
          {main[1]}
        </button>
      </div>
      <div className="timer-live-text">
        <span className="timer-live-name">{phase === "paused" ? `${name} · ${tr("En pause", "Paused")}` : name}</span>
        <span className="timer-live-time">{ringing ? tr("Terminé", "Time's up") : countdown(left)}</span>
      </div>
    </div>
  );
}

const ROW = 30;

/** A wheel of numbers: one notch of the mouse wheel, or a click, moves it. */
function Wheel({ value, max, unit, onChange }: { value: number; max: number; unit: string; onChange(v: number): void }) {
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef(value);
  latest.current = value;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      onChange(Math.min(Math.max(latest.current + Math.sign(e.deltaY), 0), max));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [max, onChange]);
  return (
    <div className="timer-wheel" ref={ref}>
      <div className="timer-wheel-rows" style={{ transform: `translateY(${-value * ROW}px)` }}>
        {Array.from({ length: max + 1 }, (_, i) => (
          <div
            key={i}
            className={`timer-wheel-row ${i === value ? "timer-wheel-row--on" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange(i);
            }}
          >
            {i}
          </div>
        ))}
      </div>
      <span className="timer-wheel-unit">{unit}</span>
    </div>
  );
}

/** No timer yet: the wheels, and Start. */
export function TimerPicker({
  value,
  onChange,
  onStart,
}: {
  value: { h: number; m: number; s: number };
  onChange(v: { h: number; m: number; s: number }): void;
  onStart(): void;
}) {
  const tr = useTr();
  const empty = value.h + value.m + value.s === 0;
  return (
    <div className="timer-picker">
      <div className="timer-wheels">
        <span className="timer-wheels-band" aria-hidden="true" />
        <Wheel value={value.h} max={23} unit="h" onChange={(h) => onChange({ ...value, h })} />
        <Wheel value={value.m} max={59} unit="min" onChange={(m) => onChange({ ...value, m })} />
        <Wheel value={value.s} max={59} unit="s" onChange={(s) => onChange({ ...value, s })} />
      </div>
      <button
        type="button"
        className="timer-round timer-round--start"
        disabled={empty}
        onClick={(e) => {
          e.stopPropagation();
          onStart();
        }}
      >
        {tr("Démarrer", "Start")}
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- Calendar */

export const CALENDAR_ACTIVITY: Size = [250, 34, 17];
export const CALENDAR_PEEK: Size = [380, 52, 24];
export const agendaSize = (days: number, rows: number): Size => [420, 14 + days * 22 + rows * 46 + 10, 26];

export function CalendarIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

function Join({ compact, onJoin }: { compact?: boolean; onJoin(): void }) {
  const tr = useTr();
  return (
    <button
      type="button"
      className={`cal-join ${compact ? "cal-join--compact" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onJoin();
      }}
    >
      {tr("Rejoindre", "Join")}
    </button>
  );
}

const inMinutes = (tr: ReturnType<typeof useTr>, minutes: number) => (minutes > 0 ? tr(`dans ${minutes} min`, `in ${minutes} min`) : tr("Maintenant", "Now"));

export function CalendarActivity({ event, minutes }: { event: DemoEvent; minutes: number }) {
  const tr = useTr();
  return (
    <div className="cal-activity">
      <CalendarIcon size={16} />
      <span className="cal-activity-title">{event.title}</span>
      <span className="cal-activity-when">{inMinutes(tr, minutes)}</span>
    </div>
  );
}

export function CalendarPeek({ event, minutes, onJoin }: { event: DemoEvent; minutes: number; onJoin(): void }) {
  const tr = useTr();
  return (
    <div className="cal-peek">
      <span className="cal-peek-icon">
        <CalendarIcon size={18} />
      </span>
      <span className="cal-peek-text">
        <span className="cal-peek-title">{event.title}</span>
        <span className="cal-peek-when">{inMinutes(tr, minutes)}</span>
      </span>
      {event.service && <Join compact onJoin={onJoin} />}
    </div>
  );
}

/** "10:00", the event's time from now, in the page's language. */
function clockIn(minutesFromNow: number, locale: string): string {
  return new Date(Date.now() + minutesFromNow * 60_000).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export function CalendarPanel({ events, locale, live, onJoin }: { events: DemoEvent[]; locale: string; live: string | null; onJoin(e: DemoEvent): void }) {
  const tr = useTr();
  const days = [0, 1].map((day) => ({ day, list: events.filter((e) => e.day === day) })).filter((d) => d.list.length);
  return (
    <div className="cal-panel">
      {days.map(({ day, list }) => (
        <section key={day} className="cal-day">
          <h3 className="cal-day-name">{day === 0 ? tr("Aujourd'hui", "Today") : tr("Demain", "Tomorrow")}</h3>
          {list.map((e) => (
            <div key={e.id} className={`cal-row ${live === e.id ? "cal-row--live" : ""}`}>
              <span className="cal-bar" />
              <span className="cal-time">{clockIn(e.inMinutes, locale)}</span>
              <span className="cal-text">
                <span className="cal-title">{e.title}</span>
                <span className="cal-sub">
                  {clockIn(e.inMinutes, locale)} – {clockIn(e.inMinutes + e.lengthMinutes, locale)}
                  {e.service ? ` · ${e.service}` : e.location ? ` · ${e.location}` : ""}
                </span>
              </span>
              {e.service && <Join onJoin={() => onJoin(e)} />}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Mirror */

export const MIRROR_SIZE: Size = [372, 222, 28];

export function MirrorIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Zm12 2.5 4-2.5v8l-4-2.5" />
    </svg>
  );
}

/**
 * The mirror: in the app, the webcam. Here, a drawn stand-in: the page never
 * asks for the camera.
 */
export function MirrorView() {
  const tr = useTr();
  return (
    <div className="mirror">
      <div className="mirror-frame mirror-frame--on mirror-demo">
        <div className="mirror-demo-light" />
        <svg className="mirror-demo-person" viewBox="0 0 200 120" aria-hidden="true">
          <ellipse cx="100" cy="128" rx="62" ry="40" />
          <circle cx="100" cy="58" r="27" />
        </svg>
        <span className="mirror-demo-note">{tr("Dans l'app : votre webcam, en miroir", "In the app: your webcam, mirrored")}</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Audio sources */

/** Dots for the apps playing, as an iPhone's page dots: the one shown is a bar. */
export function SourceDots({
  sources,
  active,
  onSelect,
}: {
  sources: { app: string; playing: boolean }[];
  active: number;
  onSelect(i: number): void;
}) {
  const tr = useTr();
  if (sources.length < 2) return null;
  return (
    <div className="media-sources" role="tablist" aria-label={tr("Sources audio", "Audio sources")}>
      {sources.map((s, i) => (
        <button
          key={s.app}
          type="button"
          role="tab"
          aria-selected={i === active}
          aria-label={s.app}
          title={s.app}
          className={`media-source ${i === active ? "media-source--on" : ""} ${s.playing ? "media-source--playing" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(i);
          }}
        >
          <span className="media-source-dot" />
        </button>
      ))}
    </div>
  );
}
