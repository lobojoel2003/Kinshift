import { describe, expect, it } from "vitest";
import {
  adherencePercent,
  checkPrnDose,
  describeSchedule,
  doseInstantsBetween,
  doseInstantsForDate,
  doseState,
  dosesPerDay,
  isScheduledOn,
  stockStatus,
  timeOfDayLabel,
  type MedSchedule,
} from "@/lib/meds";
import { HOUR, MINUTE, localTimeOf, zonedInstant } from "@/lib/time";

const tz = "America/Chicago";
const daily: MedSchedule = {
  scheduleType: "scheduled",
  times: ["20:00", "08:00"],
  daysOfWeek: null,
  startDate: "2026-11-01",
  endDate: null,
  active: true,
};

describe("which days a medication is due", () => {
  it("respects start and end dates", () => {
    expect(isScheduledOn(daily, "2026-10-31")).toBe(false);
    expect(isScheduledOn(daily, "2026-11-01")).toBe(true);
    expect(isScheduledOn({ ...daily, endDate: "2026-11-05" }, "2026-11-05")).toBe(true);
    expect(isScheduledOn({ ...daily, endDate: "2026-11-05" }, "2026-11-06")).toBe(false);
  });

  it("respects weekdays", () => {
    const mwf = { ...daily, daysOfWeek: [1, 3, 5] };
    expect(isScheduledOn(mwf, "2026-11-02")).toBe(true); // Monday
    expect(isScheduledOn(mwf, "2026-11-03")).toBe(false); // Tuesday
  });

  it("never schedules stopped or as-needed medications", () => {
    expect(isScheduledOn({ ...daily, active: false }, "2026-11-02")).toBe(false);
    expect(isScheduledOn({ ...daily, scheduleType: "prn" }, "2026-11-02")).toBe(false);
  });
});

describe("dose instants", () => {
  it("lists a day's doses in order, in the circle's time zone", () => {
    const doses = doseInstantsForDate(daily, "2026-11-03", tz);
    expect(doses.map((d) => localTimeOf(d, tz))).toEqual(["08:00", "20:00"]);
    expect(doses[0].toISOString()).toBe("2026-11-03T14:00:00.000Z");
  });

  it("keeps doses at the same local time across the DST change", () => {
    const from = zonedInstant("2026-10-31", "00:00", tz);
    const to = zonedInstant("2026-11-03", "00:00", tz);
    const doses = doseInstantsBetween({ ...daily, startDate: "2026-10-01" }, from, to, tz);
    expect(doses).toHaveLength(6);
    expect(new Set(doses.map((d) => localTimeOf(d, tz)))).toEqual(new Set(["08:00", "20:00"]));
  });

  it("does not duplicate doses across range boundaries", () => {
    const at8 = zonedInstant("2026-11-03", "08:00", tz);
    expect(doseInstantsBetween(daily, at8, new Date(at8.getTime() + 1), tz)).toHaveLength(1);
    expect(
      doseInstantsBetween(daily, new Date(at8.getTime() + 1), new Date(at8.getTime() + 2), tz),
    ).toHaveLength(0);
  });
});

describe("dose state", () => {
  const t = zonedInstant("2026-11-03", "08:00", tz);
  const at = (minutes: number) => new Date(t.getTime() + minutes * MINUTE);
  const state = (minutes: number, logStatus: "given" | "skipped" | null = null) =>
    doseState({ scheduledFor: t, now: at(minutes), graceMinutes: 60, logStatus });

  it("moves from upcoming to due to late to missed", () => {
    expect(state(-120)).toBe("upcoming");
    expect(state(-30)).toBe("due");
    expect(state(10)).toBe("due");
    expect(state(30)).toBe("late");
    expect(state(60)).toBe("late");
    expect(state(61)).toBe("missed");
  });

  it("is settled once someone logs it", () => {
    expect(state(200, "given")).toBe("given");
    expect(state(-60, "skipped")).toBe("skipped");
  });
});

describe("as-needed safety limits", () => {
  const now = new Date("2026-11-03T18:00:00Z");

  it("allows a dose when nothing was given recently", () => {
    expect(
      checkPrnDose({
        lastGivenAt: null,
        givenInLast24h: 0,
        minIntervalMinutes: 360,
        maxPerDay: 4,
        now,
      }),
    ).toEqual({ allowed: true });
  });

  it("blocks a dose given too soon and says when the next is allowed", () => {
    const res = checkPrnDose({
      lastGivenAt: new Date(now.getTime() - 2 * HOUR),
      givenInLast24h: 1,
      minIntervalMinutes: 360,
      maxPerDay: 4,
      now,
    });
    expect(res.allowed).toBe(false);
    if (!res.allowed && res.reason === "interval") {
      expect(res.nextAllowedAt.getTime()).toBe(now.getTime() + 4 * HOUR);
    } else throw new Error("expected an interval block");
  });

  it("blocks once the daily maximum is reached", () => {
    const res = checkPrnDose({
      lastGivenAt: new Date(now.getTime() - 7 * HOUR),
      givenInLast24h: 4,
      minIntervalMinutes: 360,
      maxPerDay: 4,
      now,
    });
    expect(res).toEqual({ allowed: false, reason: "max", maxPerDay: 4 });
  });
});

describe("supply and summaries", () => {
  it("counts doses per day", () => {
    expect(dosesPerDay(daily)).toBe(2);
    expect(dosesPerDay({ ...daily, daysOfWeek: [1, 3, 5], times: ["08:00"] })).toBeCloseTo(3 / 7);
    expect(dosesPerDay({ ...daily, scheduleType: "prn" })).toBe(0);
  });

  it("warns when supply is low or out", () => {
    expect(
      stockStatus({ stockCount: null, stockAlertAt: null, doseQuantity: 1, perDay: 2 }).level,
    ).toBe("untracked");
    expect(stockStatus({ stockCount: 60, stockAlertAt: null, doseQuantity: 1, perDay: 2 })).toEqual(
      { level: "ok", daysLeft: 30 },
    );
    expect(
      stockStatus({ stockCount: 10, stockAlertAt: null, doseQuantity: 1, perDay: 2 }).level,
    ).toBe("low");
    expect(stockStatus({ stockCount: 10, stockAlertAt: 5, doseQuantity: 1, perDay: 2 }).level).toBe(
      "ok",
    );
    expect(stockStatus({ stockCount: 0, stockAlertAt: 5, doseQuantity: 1, perDay: 2 }).level).toBe(
      "out",
    );
    expect(
      stockStatus({ stockCount: 12, stockAlertAt: null, doseQuantity: 2, perDay: 2 }).daysLeft,
    ).toBe(3);
  });

  it("describes schedules in plain language", () => {
    expect(describeSchedule(daily)).toMatch(/^Daily at 8:00\sAM and 8:00\sPM$/);
    expect(describeSchedule({ ...daily, times: ["09:00"], daysOfWeek: [5, 1] }, false)).toBe(
      "Mon, Fri at 09:00",
    );
    expect(
      describeSchedule({ ...daily, scheduleType: "prn", minIntervalMinutes: 360, maxPerDay: 4 }),
    ).toBe("As needed · at least 6h apart · max 4 a day");
  });

  it("labels the time of day and computes adherence", () => {
    expect(timeOfDayLabel("07:30")).toBe("Morning");
    expect(timeOfDayLabel("13:00")).toBe("Afternoon");
    expect(timeOfDayLabel("19:00")).toBe("Evening");
    expect(timeOfDayLabel("23:30")).toBe("Night");
    expect(adherencePercent(10, 9)).toBe(90);
    expect(adherencePercent(0, 0)).toBeNull();
  });
});
