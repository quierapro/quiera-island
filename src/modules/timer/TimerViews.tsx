import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "motion/react";
import type { Size } from "../../island/geometry";
import { useT } from "../../i18n";
import { primeChime } from "./chime";
import { formatCountdown } from "./duration";
import { leftAt, progressAt, type Timer } from "./state";
import { pauseTimer, restartTimer, resumeTimer, startTimer, stopTimer, useTimer } from "./store";
import "./timer.css";

/** The closed island while a timer runs. */
export const TIMER_ACTIVITY_SIZE: Size = [156, 34, 17];

/** The open panel's content: the wheels to pick a duration, or the countdown. */
export function timerPanelSize(timer: Timer | null): Size {
  return timer ? [380, 92, 28] : [380, 124, 28];
}

export function TimerIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 13.5V9.5M9.5 3h5M18.5 6.5l1.2-1.2" />
    </svg>
  );
}

function PauseGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="4.5" width="4.2" height="15" rx="1.4" />
      <rect x="13.8" y="4.5" width="4.2" height="15" rx="1.4" />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7.5 5.2v13.6c0 .9 1 1.4 1.7.9l10-6.8a1.1 1.1 0 0 0 0-1.8l-10-6.8c-.7-.5-1.7 0-1.7.9Z" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </svg>
  );
}

function RepeatGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4.5H9" />
    </svg>
  );
}

/** The time, re-rendering as each second of the countdown passes. */
function useTimerNow(timer: Timer | null): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (timer?.phase !== "running") {
      setNow(Date.now());
      return;
    }
    let handle: ReturnType<typeof setTimeout>;
    const tick = () => {
      const at = Date.now();
      setNow(at);
      // Just after the next whole second of what is left.
      handle = setTimeout(tick, ((timer.endsAt - at) % 1000) + 5);
    };
    tick();
    return () => clearTimeout(handle);
  }, [timer]);
  return now;
}

/** A ring that empties as the time runs out. */
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

/** The closed island while a timer runs: the ring, and what is left. */
export function TimerActivity() {
  const t = useT().timer;
  const timer = useTimer();
  const now = useTimerNow(timer);
  if (!timer) return null;
  if (timer.phase === "ringing") {
    return (
      <div className="timer-activity timer-activity--ringing">
        <span className="timer-bell">
          <TimerIcon size={16} />
        </span>
        <span className="timer-activity-time">{t.done}</span>
      </div>
    );
  }
  return (
    <div className={`timer-activity ${timer.phase === "paused" ? "timer-activity--paused" : ""}`}>
      <Ring progress={progressAt(timer, now)} size={18} />
      <span className="timer-activity-time">{formatCountdown(leftAt(timer, now))}</span>
    </div>
  );
}

/** Height of one row of a wheel (matches `timer.css`). */
const ROW = 30;
const LAST_KEY = "quiera.timer.last";
/** The wheel's glide: quick, with no bounce past the row. */
const GLIDE = { type: "spring", stiffness: 380, damping: 36, mass: 0.8 } as const;
/** A trackpad sends small deltas: this much makes one row. */
const WHEEL_STEP = 50;

/**
 * A wheel of numbers, as on a phone, moved by a spring on the GPU: one
 * notch of the mouse wheel is one row, a drag throws it, a click on a row
 * brings it to the middle. The middle row is the value.
 */
function Wheel({ value, max, unit, label, onChange }: { value: number; max: number; unit: string; label: string; onChange(v: number): void }) {
  const ref = useRef<HTMLDivElement>(null);
  const y = useMotionValue(-value * ROW);
  const target = useRef(value);
  const [shown, setShown] = useState(value);
  const change = useRef(onChange);
  change.current = onChange;

  const go = (row: number) => {
    const next = Math.min(Math.max(row, 0), max);
    animate(y, -next * ROW, GLIDE);
    if (next === target.current) return;
    target.current = next;
    setShown(next);
    change.current(next);
  };
  const goRef = useRef(go);
  goRef.current = go;

  // React's wheel listener is passive: taking the wheel needs a real one.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let pending = 0;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      // A mouse notch is one row; a trackpad's small deltas add up to one.
      pending += e.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? e.deltaY : Math.sign(e.deltaY) * WHEEL_STEP;
      const rows = Math.trunc(pending / WHEEL_STEP) || (Math.abs(e.deltaY) >= WHEEL_STEP ? Math.sign(e.deltaY) : 0);
      if (!rows) return;
      pending = 0;
      goRef.current(target.current + rows);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  const drag = useRef<{ startY: number; from: number; moved: boolean } | null>(null);

  return (
    <div
      ref={ref}
      className="timer-wheel"
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={shown}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp") go(target.current - 1);
        else if (e.key === "ArrowDown") go(target.current + 1);
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        y.stop();
        drag.current = { startY: e.clientY, from: y.get(), moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dy = e.clientY - d.startY;
        if (Math.abs(dy) > 3) d.moved = true;
        // Past the ends it resists, as on a phone.
        const raw = d.from + dy;
        const low = -max * ROW;
        y.set(raw > 0 ? raw / 3 : raw < low ? low + (raw - low) / 3 : raw);
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        if (!d.moved) {
          // A click: the row under the pointer comes to the middle.
          const box = e.currentTarget.getBoundingClientRect();
          go(target.current + Math.round((e.clientY - (box.top + box.height / 2)) / ROW));
          return;
        }
        // Thrown: it lands where its speed would carry it.
        const landing = y.get() + y.getVelocity() * 0.12;
        go(Math.round(-landing / ROW));
      }}
      onPointerCancel={() => {
        drag.current = null;
        go(target.current);
      }}
    >
      <motion.div className="timer-wheel-rows" style={{ y }}>
        {Array.from({ length: max + 1 }, (_, i) => (
          <div key={i} className={`timer-wheel-row ${i === shown ? "timer-wheel-row--on" : ""}`}>
            {i}
          </div>
        ))}
      </motion.div>
      <span className="timer-wheel-unit">{unit}</span>
    </div>
  );
}

function readLast(): number {
  try {
    const ms = Number(localStorage.getItem(LAST_KEY));
    return ms >= 1000 && ms < 24 * 3_600_000 ? ms : 5 * 60_000;
  } catch {
    return 5 * 60_000;
  }
}

/** No timer yet: hours, minutes and seconds on wheels, and Start. */
function TimerPicker() {
  const t = useT().timer;
  const [initial] = useState(readLast);
  const [h, setH] = useState(Math.floor(initial / 3_600_000));
  const [m, setM] = useState(Math.floor((initial % 3_600_000) / 60_000));
  const [s, setS] = useState(Math.floor((initial % 60_000) / 1000));
  const ms = ((h * 60 + m) * 60 + s) * 1000;
  const start = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ms) return;
    try {
      localStorage.setItem(LAST_KEY, String(ms));
    } catch {
      // Not remembered: the wheels start at 5 minutes next time.
    }
    // The chime is allowed from this click on.
    primeChime();
    startTimer(ms, false);
  };
  return (
    <div className="timer-picker">
      <div className="timer-wheels">
        <span className="timer-wheels-band" aria-hidden="true" />
        <Wheel value={h} max={23} unit="h" label={t.hours} onChange={setH} />
        <Wheel value={m} max={59} unit="min" label={t.minutes} onChange={setM} />
        <Wheel value={s} max={59} unit="s" label={t.seconds} onChange={setS} />
      </div>
      <button className="timer-round timer-round--start" disabled={!ms} onClick={start}>
        {t.start}
      </button>
    </div>
  );
}

/** The timer's tab: the wheels, or the countdown with its two round buttons. */
export function TimerPanel() {
  const t = useT().timer;
  const timer = useTimer();
  const now = useTimerNow(timer);
  if (!timer) return <TimerPicker />;
  const press = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    action();
  };
  const ringing = timer.phase === "ringing";
  const name = timer.pomodoro ? t.pomodoro : t.title;
  const [mainLabel, mainAction, mainGlyph] = ringing
    ? [t.restart, restartTimer, <RepeatGlyph />]
    : timer.phase === "paused"
      ? [t.resume, resumeTimer, <PlayGlyph />]
      : [t.pause, pauseTimer, <PauseGlyph />];
  return (
    <div className={`timer-live ${ringing ? "timer-live--ringing" : ""} ${timer.phase === "paused" ? "timer-live--paused" : ""}`}>
      <div className="timer-live-buttons">
        <button className="timer-circle timer-circle--gray" aria-label={t.stop} title={t.stop} onClick={press(stopTimer)}>
          <CloseGlyph />
        </button>
        <button className="timer-circle timer-circle--orange" aria-label={mainLabel} title={mainLabel} onClick={press(mainAction)}>
          {mainGlyph}
        </button>
      </div>
      <div className="timer-live-text">
        <span className="timer-live-name">{timer.phase === "paused" ? `${name} · ${t.paused}` : name}</span>
        <span className="timer-live-time">{ringing ? t.done : formatCountdown(leftAt(timer, now))}</span>
      </div>
    </div>
  );
}
