import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { AppointmentItem, GapItem, ShiftItem } from "@/components/schedule-items";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, Badge, PageHeader, Stat } from "@/components/ui/misc";
import { requireCircle } from "@/lib/auth/dal";
import { cn } from "@/lib/cn";
import { colorClasses } from "@/lib/colors";
import {
  coverageGaps,
  coverageWindow,
  coveredMs,
  dutyByAssignee,
  findClashes,
  toInterval,
  type Interval,
} from "@/lib/coverage";
import { appointmentsBetween, shiftsBetween } from "@/lib/data";
import type { AppointmentView, ShiftView } from "@/lib/domain";
import { canEdit } from "@/lib/roles";
import {
  DAY,
  addDays,
  dayBounds,
  formatClock,
  formatDateString,
  formatHours,
  isDateString,
  localDateOf,
  startOfWeek,
  todayIn,
} from "@/lib/time";

export const metadata: Metadata = { title: "Schedule" };

type Entry =
  | { kind: "shift"; at: number; shift: ShiftView }
  | { kind: "gap"; at: number; gap: Interval }
  | { kind: "appt"; at: number; appt: AppointmentView };

export default async function SchedulePage(props: PageProps<"/c/[circleId]/schedule">) {
  const { circleId } = await props.params;
  const sp = await props.searchParams;
  const ctx = await requireCircle(circleId);
  const { circle, user } = ctx;
  const tz = circle.timezone;
  const now = new Date();
  const today = todayIn(tz, now);
  const requested = typeof sp.week === "string" && isDateString(sp.week) ? sp.week : today;
  const weekStart = startOfWeek(requested);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const from = dayBounds(weekStart, tz).start;
  const to = dayBounds(addDays(weekStart, 7), tz).start;
  const shifts = shiftsBetween(ctx, new Date(from.getTime() - DAY), new Date(to.getTime() + DAY));
  const appts = appointmentsBetween(ctx, from, to);
  const clashes = findClashes(appts);
  const base = `/c/${circleId}`;

  // Weekly totals within the circle's coverage window.
  const windows = days.map((d) => coverageWindow(d, tz, circle.coverageStart, circle.coverageEnd));
  const assigned = shifts.filter((s) => s.assigneeId).map(toInterval);
  const windowMs = windows.reduce((sum, w) => sum + (w.end - w.start), 0);
  const coveredTotal = windows.reduce((sum, w) => sum + coveredMs(w, assigned), 0);
  const weekShifts = shifts.filter((s) => s.startsAt >= from && s.startsAt < to);
  const openCount = weekShifts.filter((s) => !s.assigneeId && s.endsAt > now).length;
  const perPerson = dutyByAssignee(shifts, from, to);
  const gapsByDay = new Map(
    days.map((d) => [d, coverageGaps(d, tz, circle, shifts).filter((g) => g.end > now.getTime())]),
  );
  const futureGapMs = [...gapsByDay.values()]
    .flat()
    .reduce((sum, g) => sum + (g.end - Math.max(g.start, now.getTime())), 0);
  const coverage24h = circle.coverageStart === circle.coverageEnd;

  return (
    <div>
      <PageHeader
        title="Schedule"
        description={
          coverage24h
            ? "Who is with them, around the clock."
            : `Who is on duty between ${formatClock(circle.coverageStart, user.hour12)} and ${formatClock(circle.coverageEnd, user.hour12)}.`
        }
        actions={
          ctx.canEdit && (
            <>
              <ButtonLink href={`${base}/appointments/new`} variant="outline">
                <CalendarPlus aria-hidden /> Appointment
              </ButtonLink>
              <ButtonLink
                href={`${base}/schedule/shifts/new?date=${requested < today ? today : requested}`}
              >
                <Plus aria-hidden /> Shift
              </ButtonLink>
            </>
          )
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link
            href={`${base}/schedule?week=${addDays(weekStart, -7)}`}
            className={buttonClasses("outline", "icon-sm")}
            aria-label="Previous week"
          >
            <ChevronLeft aria-hidden />
          </Link>
          <Link
            href={`${base}/schedule?week=${addDays(weekStart, 7)}`}
            className={buttonClasses("outline", "icon-sm")}
            aria-label="Next week"
          >
            <ChevronRight aria-hidden />
          </Link>
          <h2 className="ml-2 font-semibold">
            {formatDateString(weekStart, "short")} –{" "}
            {formatDateString(addDays(weekStart, 6), "short")}
          </h2>
          {weekStart !== startOfWeek(today) && (
            <Link href={`${base}/schedule`} className={buttonClasses("ghost", "sm", "ml-1")}>
              This week
            </Link>
          )}
        </div>
        <Link
          href={`${base}/appointments`}
          className="text-sm font-medium text-brand hover:underline"
        >
          All appointments
        </Link>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Covered"
          value={windowMs > 0 ? `${Math.round((coveredTotal / windowMs) * 100)}%` : "–"}
          hint={`${formatHours(coveredTotal)} of ${formatHours(windowMs)}`}
          tone={coveredTotal >= windowMs ? "success" : undefined}
        />
        <Stat
          label="Still uncovered"
          value={formatHours(futureGapMs)}
          hint="from now on"
          tone={futureGapMs > 0 ? "danger" : "success"}
        />
        <Stat
          label="Open shifts"
          value={openCount}
          tone={openCount > 0 ? "warning" : undefined}
          hint="need someone"
        />
        <Stat
          label="Appointments"
          value={appts.length}
          hint={clashes.size > 0 ? `${clashes.size} clashing` : "this week"}
          tone={clashes.size > 0 ? "warning" : undefined}
        />
      </div>

      <Card className="mb-5 p-4">
        <p className="mb-3 text-sm font-medium">Hours on duty this week</p>
        <ul className="flex flex-wrap gap-x-5 gap-y-3">
          {ctx.members
            .filter((m) => canEdit(m.role))
            .map((m) => {
              const ms = perPerson.get(m.userId) ?? 0;
              return (
                <li key={m.userId} className="flex items-center gap-2 text-sm">
                  <Avatar name={m.name} color={m.color} size="sm" />
                  <span>{m.userId === user.id ? "You" : m.name.split(" ")[0]}</span>
                  <span className={cn("tabular font-semibold", colorClasses(m.color).text)}>
                    {formatHours(ms)}
                  </span>
                </li>
              );
            })}
        </ul>
      </Card>

      <ol className="space-y-3">
        {days.map((d) => {
          const { start, end } = dayBounds(d, tz);
          const isToday = d === today;
          const past = d < today;
          const entries: Entry[] = [
            ...shifts
              .filter((s) => localDateOf(s.startsAt, tz) === d)
              .map((shift) => ({ kind: "shift" as const, at: shift.startsAt.getTime(), shift })),
            ...(gapsByDay.get(d) ?? []).map((gap) => ({
              kind: "gap" as const,
              at: gap.start,
              gap,
            })),
            ...appts
              .filter((a) => a.startsAt >= start && a.startsAt < end)
              .map((appt) => ({ kind: "appt" as const, at: appt.startsAt.getTime(), appt })),
          ].sort((a, b) => a.at - b.at);
          const list =
            entries.length === 0 ? (
              <p className="px-1 pb-1 text-sm text-faint">
                {past ? "Nothing recorded." : "Nothing planned."}
              </p>
            ) : (
              <div className="space-y-2">
                {entries.map((e) =>
                  e.kind === "shift" ? (
                    <ShiftItem key={e.shift.id} shift={e.shift} ctx={ctx} now={now} />
                  ) : e.kind === "gap" ? (
                    <GapItem key={`gap-${e.gap.start}`} gap={e.gap} ctx={ctx} now={now} />
                  ) : (
                    <AppointmentItem
                      key={e.appt.id}
                      appt={e.appt}
                      ctx={ctx}
                      now={now}
                      showDate={false}
                      clashesWith={(clashes.get(e.appt.id) ?? [])
                        .map((id) => appts.find((a) => a.id === id)!)
                        .filter(Boolean)}
                    />
                  ),
                )}
              </div>
            );

          if (past) {
            // Earlier days this week fold away so today and what's next come first.
            const shiftCount = entries.filter((e) => e.kind === "shift").length;
            const apptCount = entries.filter((e) => e.kind === "appt").length;
            const summary =
              [
                shiftCount ? `${shiftCount} shift${shiftCount > 1 ? "s" : ""}` : "",
                apptCount ? `${apptCount} appointment${apptCount > 1 ? "s" : ""}` : "",
              ]
                .filter(Boolean)
                .join(" · ") || "Nothing recorded";
            return (
              <li key={d}>
                <details className="group rounded-2xl border border-line bg-surface/60 px-3 py-2.5 sm:px-4">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm [&::-webkit-details-marker]:hidden">
                    <ChevronRight
                      className="size-4 text-faint transition-transform group-open:rotate-90"
                      aria-hidden
                    />
                    <span className="w-10 font-medium text-faint uppercase">
                      {formatDateString(d, "weekdayShort")}
                    </span>
                    <span className="font-medium text-muted">{formatDateString(d, "short")}</span>
                    <span className="ml-auto text-xs text-faint">{summary}</span>
                  </summary>
                  <div className="mt-3">{list}</div>
                </details>
              </li>
            );
          }

          return (
            <li key={d}>
              <section
                className={cn(
                  "rounded-2xl border bg-surface p-3 shadow-card sm:p-4",
                  isToday ? "border-brand/40 ring-1 ring-brand/20" : "border-line",
                )}
                aria-label={formatDateString(d, "long")}
              >
                <header className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <span className="w-10 text-sm font-medium text-muted uppercase">
                      {formatDateString(d, "weekdayShort")}
                    </span>
                    {formatDateString(d, "short")}
                    {isToday && <Badge tone="brand">Today</Badge>}
                  </h3>
                  {ctx.canEdit && (
                    <Link
                      href={`${base}/schedule/shifts/new?date=${d}`}
                      className={buttonClasses("ghost", "sm", "text-muted")}
                      aria-label={`Add shift on ${formatDateString(d, "long")}`}
                    >
                      <Plus aria-hidden /> Shift
                    </Link>
                  )}
                </header>
                {list}
              </section>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
