import { TZDate } from "@date-fns/tz";

/**
 * Time helpers. Kinshift stores instants in UTC and interprets wall-clock
 * values ("08:00", "2026-03-08") in the circle's IANA time zone, which is the
 * time zone the person being cared for lives in.
 */

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const LOCALE = process.env.KINSHIFT_LOCALE ?? "en-US";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isDateString(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export function isTimeString(value: string): boolean {
  return TIME_RE.test(value);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "HH:MM" -> minutes after midnight. */
export function minutesOf(time: string): number {
  const m = TIME_RE.exec(time);
  if (!m) throw new Error(`Invalid time: ${time}`);
  return +m[1] * 60 + +m[2];
}

const partsCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string) {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    partsCache.set(tz, f);
  }
  return f;
}

function localParts(instant: Date, tz: string) {
  const out: Record<string, string> = {};
  for (const p of partsFormatter(tz).formatToParts(instant)) out[p.type] = p.value;
  return out;
}

/** Local calendar date ("YYYY-MM-DD") of an instant in a time zone. */
export function localDateOf(instant: Date, tz: string): string {
  const p = localParts(instant, tz);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Local wall-clock time ("HH:MM") of an instant in a time zone. */
export function localTimeOf(instant: Date, tz: string): string {
  const p = localParts(instant, tz);
  return `${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}

export function todayIn(tz: string, now: Date = new Date()): string {
  return localDateOf(now, tz);
}

/** The UTC instant for a local date and time in a time zone. */
export function zonedInstant(date: string, time: string, tz: string): Date {
  const m = DATE_RE.exec(date);
  if (!m) throw new Error(`Invalid date: ${date}`);
  const minutes = minutesOf(time);
  const tzDate = new TZDate(+m[1], +m[2] - 1, +m[3], Math.floor(minutes / 60), minutes % 60, tz);
  return new Date(tzDate.getTime());
}

/** Local midnight-to-midnight bounds of a date. Handles 23h/25h DST days. */
export function dayBounds(date: string, tz: string): { start: Date; end: Date } {
  return {
    start: zonedInstant(date, "00:00", tz),
    end: zonedInstant(addDays(date, 1), "00:00", tz),
  };
}

export function addDays(date: string, days: number): string {
  const m = DATE_RE.exec(date);
  if (!m) throw new Error(`Invalid date: ${date}`);
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + days));
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekdayOf(date: string): number {
  const m = DATE_RE.exec(date);
  if (!m) throw new Error(`Invalid date: ${date}`);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: string): string {
  const wd = weekdayOf(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string, options: Intl.DateTimeFormatOptions) {
  const key = tz + JSON.stringify(options);
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALE, { timeZone: tz, ...options });
    fmtCache.set(key, f);
  }
  return f;
}

export function formatTime(instant: Date, tz: string, hour12 = true): string {
  return fmt(tz, { hour: "numeric", minute: "2-digit", hour12 }).format(instant);
}

/** Format a wall-clock "HH:MM" string without a time zone. */
export function formatClock(time: string, hour12 = true): string {
  const minutes = minutesOf(time);
  const d = new Date(Date.UTC(2000, 0, 1, Math.floor(minutes / 60), minutes % 60));
  return fmt("UTC", { hour: "numeric", minute: "2-digit", hour12 }).format(d);
}

export function formatTimeRange(start: Date, end: Date, tz: string, hour12 = true): string {
  const sameDay = localDateOf(start, tz) === localDateOf(new Date(end.getTime() - 1), tz);
  const s = formatTime(start, tz, hour12);
  const e = formatTime(end, tz, hour12);
  return sameDay ? `${s} – ${e}` : `${s} – ${e} (+1 day)`;
}

export function formatDate(
  instant: Date,
  tz: string,
  style: "short" | "medium" | "long" | "weekday" = "medium",
): string {
  const options: Record<typeof style, Intl.DateTimeFormatOptions> = {
    short: { month: "short", day: "numeric" },
    medium: { weekday: "short", month: "short", day: "numeric" },
    long: { weekday: "long", month: "long", day: "numeric", year: "numeric" },
    weekday: { weekday: "long" },
  };
  return fmt(tz, options[style]).format(instant);
}

/** Format a calendar date string ("YYYY-MM-DD"). */
export function formatDateString(
  date: string,
  style: "short" | "medium" | "long" | "weekday" | "weekdayShort" = "medium",
): string {
  const instant = new Date(`${date}T12:00:00Z`);
  if (style === "weekdayShort") return fmt("UTC", { weekday: "short" }).format(instant);
  return formatDate(instant, "UTC", style);
}

export function formatDateTime(instant: Date, tz: string, hour12 = true): string {
  return `${formatDate(instant, tz, "medium")}, ${formatTime(instant, tz, hour12)}`;
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(Math.abs(ms) / MINUTE);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatHours(ms: number): string {
  const hours = ms / HOUR;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

export function formatRelative(instant: Date, now: Date = new Date()): string {
  const diff = instant.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const future = diff > 0;
  if (abs < MINUTE) return future ? "in a moment" : "just now";
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  if (abs < HOUR) return rtf.format(Math.round(diff / MINUTE), "minute");
  if (abs < DAY) return rtf.format(Math.round(diff / HOUR), "hour");
  if (abs < 7 * DAY) return rtf.format(Math.round(diff / DAY), "day");
  return rtf.format(Math.round(diff / (7 * DAY)), "week");
}

export function greeting(now: Date, tz: string): string {
  const hour = minutesOf(localTimeOf(now, tz)) / 60;
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** A short list of common time zones for pickers, plus the full IANA list when available. */
export function timeZoneOptions(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  const all = intl.supportedValuesOf?.("timeZone") ?? [];
  return all.length > 0
    ? all
    : [
        "UTC",
        "America/New_York",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles",
        "Europe/London",
      ];
}

/** Whole years between a date of birth and today (both "YYYY-MM-DD"). */
export function ageFrom(dob: string, today: string): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age--;
  return age >= 0 && age < 130 ? age : null;
}
