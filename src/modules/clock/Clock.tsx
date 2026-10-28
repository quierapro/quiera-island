import { useEffect, useState } from "react";
import type { Size } from "../../island/geometry";
import { formatClock, formatDay, msUntilNextMinute } from "./time";
import "./clock.css";

/** The open panel when nothing plays: time and date. */
export const CLOCK_PANEL_SIZE: Size = [260, 92, 26];

/** The current time, re-rendering once a minute, on the minute. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const date = new Date();
      setNow(date);
      timer = setTimeout(tick, msUntilNextMinute(date));
    };
    timer = setTimeout(tick, msUntilNextMinute(new Date()));
    return () => clearTimeout(timer);
  }, []);
  return now;
}

/** The pill at rest: just the time. */
export function IdleClock() {
  const now = useNow();
  return (
    <div className="clock-idle">
      <time dateTime={now.toISOString()}>{formatClock(now)}</time>
    </div>
  );
}

/** Open without music: the time, large, and the day. */
export function ClockPanel() {
  const now = useNow();
  return (
    <div className="clock-panel">
      <time className="clock-panel-time" dateTime={now.toISOString()}>
        {formatClock(now)}
      </time>
      <span className="clock-panel-day">{formatDay(now)}</span>
    </div>
  );
}
