import { MINUTE, addDays, minutesOf, zonedInstant } from "@/lib/time";

/**
 * Care coverage: who is on duty, where the gaps are, and which events clash.
 * Pure functions on millisecond intervals.
 */

export type Interval = { start: number; end: number };

export const MIN_GAP_MS = 15 * MINUTE;

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter((i) => i.end > i.start)
    .map((i) => ({ ...i }))
    .sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push(i);
  }
  return out;
}

/** Parts of `window` not covered by any interval, ignoring slivers shorter than `minGapMs`. */
export function uncovered(
  window: Interval,
  covered: Interval[],
  minGapMs = MIN_GAP_MS,
): Interval[] {
  const gaps: Interval[] = [];
  let cursor = window.start;
  for (const c of mergeIntervals(covered)) {
    if (c.end <= window.start || c.start >= window.end) continue;
    if (c.start > cursor) gaps.push({ start: cursor, end: Math.min(c.start, window.end) });
    cursor = Math.max(cursor, c.end);
    if (cursor >= window.end) break;
  }
  if (cursor < window.end) gaps.push({ start: cursor, end: window.end });
  return gaps.filter((g) => g.end - g.start >= minGapMs);
}

export function coveredMs(window: Interval, covered: Interval[]): number {
  let total = 0;
  for (const c of mergeIntervals(covered)) {
    const s = Math.max(c.start, window.start);
    const e = Math.min(c.end, window.end);
    if (e > s) total += e - s;
  }
  return total;
}

/**
 * The window of a local date that should have someone on duty.
 * Equal start and end means round-the-clock care; an end before the start
 * means the window runs past midnight (for example night care 20:00–08:00).
 */
export function coverageWindow(
  date: string,
  tz: string,
  coverageStart: string,
  coverageEnd: string,
): Interval {
  const start = zonedInstant(date, coverageStart, tz).getTime();
  const endDate = minutesOf(coverageEnd) <= minutesOf(coverageStart) ? addDays(date, 1) : date;
  const end = zonedInstant(endDate, coverageEnd, tz).getTime();
  return { start, end };
}

export type ShiftLike = { id: string; startsAt: Date; endsAt: Date; assigneeId: string | null };

export function toInterval(s: { startsAt: Date; endsAt: Date }): Interval {
  return { start: s.startsAt.getTime(), end: s.endsAt.getTime() };
}

/** Uncovered stretches of a day's coverage window. Open (unclaimed) shifts do not count as cover. */
export function coverageGaps(
  date: string,
  tz: string,
  circle: { coverageStart: string; coverageEnd: string },
  shifts: ShiftLike[],
): Interval[] {
  const window = coverageWindow(date, tz, circle.coverageStart, circle.coverageEnd);
  const covered = shifts.filter((s) => s.assigneeId).map(toInterval);
  return uncovered(window, covered);
}

/** Shifts that are active at `now`. */
export function onDutyAt<T extends ShiftLike>(shifts: T[], now: Date): T[] {
  const t = now.getTime();
  return shifts.filter((s) => s.assigneeId && s.startsAt.getTime() <= t && s.endsAt.getTime() > t);
}

/** For each item id, the ids of the other items it overlaps in time. */
export function findClashes<T extends { id: string; startsAt: Date; endsAt: Date }>(
  items: T[],
): Map<string, string[]> {
  const sorted = [...items].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const clashes = new Map<string, string[]>();
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].startsAt.getTime() >= sorted[i].endsAt.getTime()) break;
      if (overlaps(toInterval(sorted[i]), toInterval(sorted[j]))) {
        clashes.set(sorted[i].id, [...(clashes.get(sorted[i].id) ?? []), sorted[j].id]);
        clashes.set(sorted[j].id, [...(clashes.get(sorted[j].id) ?? []), sorted[i].id]);
      }
    }
  }
  return clashes;
}

/** Hours on duty per person within [from, to), clipped to that range. */
export function dutyByAssignee(shifts: ShiftLike[], from: Date, to: Date): Map<string, number> {
  const range = { start: from.getTime(), end: to.getTime() };
  const byPerson = new Map<string, Interval[]>();
  for (const s of shifts) {
    if (!s.assigneeId) continue;
    byPerson.set(s.assigneeId, [...(byPerson.get(s.assigneeId) ?? []), toInterval(s)]);
  }
  const out = new Map<string, number>();
  for (const [id, intervals] of byPerson) out.set(id, coveredMs(range, intervals));
  return out;
}
