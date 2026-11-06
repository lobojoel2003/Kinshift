import { MINUTE, addDays, formatClock, localDateOf, weekdayOf, zonedInstant } from "@/lib/time";

/**
 * Medication schedule logic. Pure functions, no database access, so the rules
 * that stop doses being missed or doubled are easy to test.
 */

export type MedSchedule = {
  scheduleType: "scheduled" | "prn";
  times: string[];
  daysOfWeek: number[] | null;
  startDate: string;
  endDate: string | null;
  active: boolean;
};

export type DoseState = "given" | "skipped" | "upcoming" | "due" | "late" | "missed";

/** How early a dose shows as "due" before its scheduled time. */
export const DUE_EARLY_MINUTES = 30;
/** After this many minutes a dose is "late" (but not yet "missed"). */
export const LATE_AFTER_MINUTES = 15;

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function isScheduledOn(med: MedSchedule, date: string): boolean {
  if (!med.active || med.scheduleType !== "scheduled") return false;
  if (date < med.startDate) return false;
  if (med.endDate && date > med.endDate) return false;
  if (med.daysOfWeek && med.daysOfWeek.length > 0 && !med.daysOfWeek.includes(weekdayOf(date))) {
    return false;
  }
  return true;
}

export function sortTimes(times: string[]): string[] {
  return [...new Set(times)].sort();
}

/** Scheduled dose instants for one local date, in order. */
export function doseInstantsForDate(med: MedSchedule, date: string, tz: string): Date[] {
  if (!isScheduledOn(med, date)) return [];
  return sortTimes(med.times).map((t) => zonedInstant(date, t, tz));
}

/** Scheduled dose instants in [from, to). */
export function doseInstantsBetween(med: MedSchedule, from: Date, to: Date, tz: string): Date[] {
  const out: Date[] = [];
  const lastDate = localDateOf(new Date(to.getTime() - 1), tz);
  // Start one day early so doses just after a DST shift are never skipped.
  for (let d = addDays(localDateOf(from, tz), -1); d <= lastDate; d = addDays(d, 1)) {
    for (const instant of doseInstantsForDate(med, d, tz)) {
      if (instant >= from && instant < to) out.push(instant);
    }
  }
  return out;
}

export function doseState(input: {
  scheduledFor: Date;
  logStatus?: "given" | "skipped" | null;
  now: Date;
  graceMinutes: number;
}): DoseState {
  if (input.logStatus) return input.logStatus;
  const t = input.scheduledFor.getTime();
  const now = input.now.getTime();
  if (now < t - DUE_EARLY_MINUTES * MINUTE) return "upcoming";
  if (now <= t + LATE_AFTER_MINUTES * MINUTE) return "due";
  if (now <= t + Math.max(input.graceMinutes, LATE_AFTER_MINUTES) * MINUTE) return "late";
  return "missed";
}

export type PrnCheck =
  | { allowed: true }
  | { allowed: false; reason: "interval"; nextAllowedAt: Date; lastGivenAt: Date }
  | { allowed: false; reason: "max"; maxPerDay: number };

/** Whether an as-needed dose can be given now without breaking its safety limits. */
export function checkPrnDose(input: {
  lastGivenAt: Date | null;
  givenInLast24h: number;
  minIntervalMinutes: number | null;
  maxPerDay: number | null;
  now: Date;
}): PrnCheck {
  if (input.maxPerDay && input.givenInLast24h >= input.maxPerDay) {
    return { allowed: false, reason: "max", maxPerDay: input.maxPerDay };
  }
  if (input.lastGivenAt && input.minIntervalMinutes) {
    const nextAllowedAt = new Date(input.lastGivenAt.getTime() + input.minIntervalMinutes * MINUTE);
    if (input.now < nextAllowedAt) {
      return { allowed: false, reason: "interval", nextAllowedAt, lastGivenAt: input.lastGivenAt };
    }
  }
  return { allowed: true };
}

export function dosesPerDay(
  med: Pick<MedSchedule, "scheduleType" | "times" | "daysOfWeek">,
): number {
  if (med.scheduleType !== "scheduled") return 0;
  const perScheduledDay = new Set(med.times).size;
  const days = med.daysOfWeek && med.daysOfWeek.length > 0 ? med.daysOfWeek.length : 7;
  return (perScheduledDay * days) / 7;
}

export type StockLevel = "untracked" | "ok" | "low" | "out";

export function stockStatus(input: {
  stockCount: number | null;
  stockAlertAt: number | null;
  doseQuantity: number;
  perDay: number;
}): { level: StockLevel; daysLeft: number | null } {
  if (input.stockCount === null || input.stockCount === undefined) {
    return { level: "untracked", daysLeft: null };
  }
  const usePerDay = input.perDay * Math.max(1, input.doseQuantity);
  const daysLeft = usePerDay > 0 ? Math.floor(input.stockCount / usePerDay) : null;
  if (input.stockCount <= 0) return { level: "out", daysLeft: 0 };
  const threshold = input.stockAlertAt ?? (usePerDay > 0 ? Math.ceil(usePerDay * 7) : 5);
  return { level: input.stockCount <= threshold ? "low" : "ok", daysLeft };
}

export function adherencePercent(expected: number, given: number): number | null {
  if (expected <= 0) return null;
  return Math.round((Math.min(given, expected) / expected) * 100);
}

export function describeSchedule(
  med: Pick<MedSchedule, "scheduleType" | "times" | "daysOfWeek"> & {
    minIntervalMinutes?: number | null;
    maxPerDay?: number | null;
  },
  hour12 = true,
): string {
  if (med.scheduleType === "prn") {
    const parts = ["As needed"];
    if (med.minIntervalMinutes) {
      const h = med.minIntervalMinutes / 60;
      parts.push(
        `at least ${Number.isInteger(h) ? `${h}h` : `${med.minIntervalMinutes} min`} apart`,
      );
    }
    if (med.maxPerDay) parts.push(`max ${med.maxPerDay} a day`);
    return parts.join(" · ");
  }
  const times = sortTimes(med.times).map((t) => formatClock(t, hour12));
  const timeText =
    times.length <= 1
      ? (times[0] ?? "no times set")
      : `${times.slice(0, -1).join(", ")} and ${times[times.length - 1]}`;
  const days =
    med.daysOfWeek && med.daysOfWeek.length > 0 && med.daysOfWeek.length < 7
      ? [...med.daysOfWeek]
          .sort()
          .map((d) => WEEKDAY_SHORT[d])
          .join(", ")
      : "Daily";
  return `${days} at ${timeText}`;
}

export function timeOfDayLabel(time: string): "Morning" | "Afternoon" | "Evening" | "Night" {
  const hour = Number(time.slice(0, 2));
  if (hour >= 5 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 17) return "Afternoon";
  if (hour >= 17 && hour < 22) return "Evening";
  return "Night";
}
