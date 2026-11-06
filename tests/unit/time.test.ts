import { describe, expect, it } from "vitest";
import {
  HOUR,
  addDays,
  ageFrom,
  dayBounds,
  daysBetween,
  formatClock,
  formatDuration,
  formatHours,
  isDateString,
  isTimeString,
  isValidTimeZone,
  localDateOf,
  localTimeOf,
  minutesOf,
  startOfWeek,
  weekdayOf,
  zonedInstant,
} from "@/lib/time";

describe("date and time strings", () => {
  it("validates dates, including leap years", () => {
    expect(isDateString("2028-02-29")).toBe(true);
    expect(isDateString("2027-02-29")).toBe(false);
    expect(isDateString("2026-13-01")).toBe(false);
    expect(isDateString("26-01-01")).toBe(false);
  });

  it("validates times", () => {
    expect(isTimeString("00:00")).toBe(true);
    expect(isTimeString("23:59")).toBe(true);
    expect(isTimeString("24:00")).toBe(false);
    expect(isTimeString("8:00")).toBe(false);
    expect(minutesOf("08:30")).toBe(510);
  });

  it("does calendar arithmetic without time zone surprises", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(weekdayOf("2026-11-06")).toBe(5);
    expect(startOfWeek("2026-11-06")).toBe("2026-11-02");
    expect(startOfWeek("2026-11-08")).toBe("2026-11-02");
    expect(startOfWeek("2026-11-09")).toBe("2026-11-09");
    expect(daysBetween("2026-11-01", "2026-11-08")).toBe(7);
  });

  it("knows real time zones", () => {
    expect(isValidTimeZone("America/Chicago")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
  });
});

describe("zoned instants", () => {
  it("converts local wall-clock time to UTC", () => {
    expect(zonedInstant("2026-07-01", "08:00", "America/New_York").toISOString()).toBe(
      "2026-07-01T12:00:00.000Z",
    );
    expect(zonedInstant("2026-01-15", "08:00", "America/New_York").toISOString()).toBe(
      "2026-01-15T13:00:00.000Z",
    );
    expect(zonedInstant("2026-01-15", "08:00", "Asia/Kolkata").toISOString()).toBe(
      "2026-01-15T02:30:00.000Z",
    );
  });

  it("round-trips through local date and time", () => {
    const tz = "Australia/Sydney";
    const instant = zonedInstant("2026-06-10", "21:15", tz);
    expect(localDateOf(instant, tz)).toBe("2026-06-10");
    expect(localTimeOf(instant, tz)).toBe("21:15");
  });

  it("handles daylight saving days", () => {
    const tz = "America/New_York";
    // 2026-03-08: clocks spring forward, the day is 23 hours long.
    const spring = dayBounds("2026-03-08", tz);
    expect(spring.end.getTime() - spring.start.getTime()).toBe(23 * HOUR);
    // 2026-11-01: clocks fall back, the day is 25 hours long.
    const fall = dayBounds("2026-11-01", tz);
    expect(fall.end.getTime() - fall.start.getTime()).toBe(25 * HOUR);
    // An 8 AM dose stays at 8 AM local time either side of the change.
    expect(localTimeOf(zonedInstant("2026-03-07", "08:00", tz), tz)).toBe("08:00");
    expect(localTimeOf(zonedInstant("2026-03-09", "08:00", tz), tz)).toBe("08:00");
  });
});

describe("formatting", () => {
  it("formats clock times in 12 and 24 hour styles", () => {
    expect(formatClock("14:05", true)).toMatch(/2:05\sPM/);
    expect(formatClock("14:05", false)).toBe("14:05");
  });

  it("formats durations", () => {
    expect(formatDuration(90 * 60_000)).toBe("1h 30m");
    expect(formatDuration(45 * 60_000)).toBe("45m");
    expect(formatDuration(2 * HOUR)).toBe("2h");
    expect(formatHours(4.5 * HOUR)).toBe("4.5h");
    expect(formatHours(12 * HOUR)).toBe("12h");
  });

  it("computes ages", () => {
    expect(ageFrom("1944-03-18", "2026-03-17")).toBe(81);
    expect(ageFrom("1944-03-18", "2026-03-18")).toBe(82);
    expect(ageFrom("", "2026-03-18")).toBeNull();
  });
});
