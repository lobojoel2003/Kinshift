import { describe, expect, it } from "vitest";
import {
  coverageGaps,
  coverageWindow,
  coveredMs,
  dutyByAssignee,
  findClashes,
  mergeIntervals,
  onDutyAt,
  uncovered,
} from "@/lib/coverage";
import { HOUR, MINUTE, localTimeOf, zonedInstant } from "@/lib/time";

const tz = "Europe/London";
const at = (time: string, date = "2026-11-03") => zonedInstant(date, time, tz);
const shift = (id: string, start: string, end: string, assigneeId: string | null = "sam") => ({
  id,
  startsAt: at(start),
  endsAt: at(end),
  assigneeId,
});

describe("interval maths", () => {
  it("merges overlapping and touching intervals", () => {
    expect(
      mergeIntervals([
        { start: 5, end: 8 },
        { start: 1, end: 3 },
        { start: 3, end: 4 },
        { start: 7, end: 10 },
      ]),
    ).toEqual([
      { start: 1, end: 4 },
      { start: 5, end: 10 },
    ]);
  });

  it("finds uncovered stretches and ignores slivers", () => {
    const window = { start: 0, end: 100 * MINUTE };
    // The 10-minute stretch before the shift is a sliver and is ignored.
    expect(uncovered(window, [{ start: 10 * MINUTE, end: 50 * MINUTE }])).toEqual([
      { start: 50 * MINUTE, end: 100 * MINUTE },
    ]);
    expect(uncovered(window, [{ start: 20 * MINUTE, end: 50 * MINUTE }])).toEqual([
      { start: 0, end: 20 * MINUTE },
      { start: 50 * MINUTE, end: 100 * MINUTE },
    ]);
    expect(uncovered(window, [{ start: 5 * MINUTE, end: 100 * MINUTE }])).toEqual([]);
    expect(coveredMs(window, [{ start: -50, end: 10 * MINUTE }])).toBe(10 * MINUTE);
  });
});

describe("coverage window", () => {
  it("handles daytime, overnight and round-the-clock care", () => {
    const day = coverageWindow("2026-11-03", tz, "08:00", "20:00");
    expect(day.end - day.start).toBe(12 * HOUR);
    const night = coverageWindow("2026-11-03", tz, "20:00", "08:00");
    expect(night.end - night.start).toBe(12 * HOUR);
    const allDay = coverageWindow("2026-11-03", tz, "00:00", "00:00");
    expect(allDay.end - allDay.start).toBe(24 * HOUR);
  });
});

describe("coverage gaps", () => {
  const circle = { coverageStart: "08:00", coverageEnd: "20:00" };

  it("reports who covers Tuesday, and when nobody does", () => {
    const gaps = coverageGaps("2026-11-03", tz, circle, [
      shift("a", "08:00", "12:00"),
      shift("b", "16:00", "20:00", "maya"),
    ]);
    expect(gaps).toHaveLength(1);
    expect(localTimeOf(new Date(gaps[0].start), tz)).toBe("12:00");
    expect(localTimeOf(new Date(gaps[0].end), tz)).toBe("16:00");
  });

  it("does not count open, unclaimed shifts as cover", () => {
    const gaps = coverageGaps("2026-11-03", tz, circle, [shift("a", "08:00", "20:00", null)]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].end - gaps[0].start).toBe(12 * HOUR);
  });

  it("returns nothing when the day is fully covered", () => {
    expect(
      coverageGaps("2026-11-03", tz, circle, [
        shift("a", "07:00", "14:00"),
        shift("b", "14:00", "21:00"),
      ]),
    ).toEqual([]);
  });
});

describe("on duty and clashes", () => {
  it("finds who is on duty right now", () => {
    const shifts = [
      shift("a", "08:00", "12:00"),
      shift("b", "12:00", "16:00", "maya"),
      shift("c", "09:00", "10:00", null),
    ];
    expect(onDutyAt(shifts, at("09:30")).map((s) => s.id)).toEqual(["a"]);
    expect(onDutyAt(shifts, at("12:00")).map((s) => s.id)).toEqual(["b"]);
  });

  it("finds overlapping appointments both ways", () => {
    const clashes = findClashes([
      { id: "cardio", startsAt: at("10:00"), endsAt: at("11:00") },
      { id: "blood", startsAt: at("10:30"), endsAt: at("10:45") },
      { id: "dentist", startsAt: at("11:00"), endsAt: at("12:00") },
    ]);
    expect(clashes.get("cardio")).toEqual(["blood"]);
    expect(clashes.get("blood")).toEqual(["cardio"]);
    expect(clashes.has("dentist")).toBe(false);
  });

  it("totals hours on duty per person within a range", () => {
    const hours = dutyByAssignee(
      [
        shift("a", "08:00", "12:00"),
        shift("b", "10:00", "14:00"),
        shift("c", "14:00", "20:00", "maya"),
        shift("d", "20:00", "22:00", null),
      ],
      at("00:00"),
      at("18:00"),
    );
    expect(hours.get("sam")).toBe(6 * HOUR);
    expect(hours.get("maya")).toBe(4 * HOUR);
    expect(hours.has("null")).toBe(false);
  });
});
