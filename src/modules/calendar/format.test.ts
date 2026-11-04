import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "../../ipc/calendar";
import { agenda, byDay, daysFrom, minutesUntil, nextMeeting } from "./format";

const MIN = 60_000;
const NOW = new Date(2026, 10, 4, 9, 50).getTime();

function event(id: string, startMin: number, lengthMin = 30, extra: Partial<CalendarEvent> = {}): CalendarEvent {
  const start = NOW + startMin * MIN;
  return { id, title: id, start, end: start + lengthMin * MIN, allDay: false, location: "", join: null, service: null, ...extra };
}

describe("nextMeeting", () => {
  it("announces a meeting within the reminder, and until a moment after it starts", () => {
    const daily = event("daily", 10);
    expect(nextMeeting([daily], NOW, 10 * MIN)).toBe(daily);
    expect(nextMeeting([daily], NOW, 5 * MIN)).toBeNull();
    expect(nextMeeting([daily], NOW + 14 * MIN, 10 * MIN)).toBe(daily);
    expect(nextMeeting([daily], NOW + 15 * MIN, 10 * MIN)).toBeNull();
  });

  it("takes the soonest, and never a whole day", () => {
    const later = event("later", 8);
    const sooner = event("sooner", 3);
    const holiday = event("holiday", 1, 24 * 60, { allDay: true });
    expect(nextMeeting([later, holiday, sooner], NOW, 10 * MIN)?.id).toBe("sooner");
    expect(nextMeeting([holiday], NOW, 10 * MIN)).toBeNull();
  });

  it("lets a short meeting end before the five minutes", () => {
    const quick = event("quick", -3, 2);
    expect(nextMeeting([quick], NOW, 10 * MIN)).toBeNull();
  });
});

describe("agenda", () => {
  it("keeps what is not over, by day", () => {
    const done = event("done", -60);
    const now = event("now", -10);
    const tomorrow = event("tomorrow", 24 * 60);
    const list = agenda([done, now, tomorrow], NOW);
    expect(list.map((e) => e.id)).toEqual(["now", "tomorrow"]);
    expect(byDay(list, NOW).map((d) => [d.day, d.events.length])).toEqual([
      [0, 1],
      [1, 1],
    ]);
  });

  it("counts minutes and days as people do", () => {
    expect(minutesUntil(NOW + 8 * MIN + 10_000, NOW)).toBe(9);
    expect(minutesUntil(NOW - MIN, NOW)).toBe(0);
    expect(daysFrom(new Date(2026, 10, 5, 0, 30).getTime(), NOW)).toBe(1);
    expect(daysFrom(new Date(2026, 10, 4, 23, 59).getTime(), NOW)).toBe(0);
  });
});
