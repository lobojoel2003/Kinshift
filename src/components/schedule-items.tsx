import Link from "next/link";
import {
  CalendarClock,
  Car,
  FlaskConical,
  Glasses,
  HandHeart,
  MapPin,
  Pencil,
  Smile,
  Stethoscope,
  TriangleAlert,
  UserRoundX,
  type LucideIcon,
} from "lucide-react";
import { takeAppointment } from "@/app/(app)/c/[circleId]/appointments/actions";
import { claimShift, coverGap, releaseShift } from "@/app/(app)/c/[circleId]/schedule/actions";
import { ActionButton } from "@/components/ui/client";
import { buttonClasses } from "@/components/ui/button";
import { Avatar, Badge } from "@/components/ui/misc";
import type { CircleContext } from "@/lib/auth/dal";
import { cn } from "@/lib/cn";
import { colorClasses } from "@/lib/colors";
import type { Interval } from "@/lib/coverage";
import type { AppointmentKind } from "@/lib/db/schema";
import type { AppointmentView, ShiftView } from "@/lib/domain";
import { formatDate, formatDuration, formatTimeRange } from "@/lib/time";

export const kindIcon: Record<AppointmentKind, LucideIcon> = {
  doctor: Stethoscope,
  therapy: HandHeart,
  lab: FlaskConical,
  dental: Smile,
  vision: Glasses,
  other: CalendarClock,
};

export function ShiftItem({
  shift,
  ctx,
  now,
  showDate = false,
}: {
  shift: ShiftView;
  ctx: CircleContext;
  now: Date;
  showDate?: boolean;
}) {
  const tz = ctx.circle.timezone;
  const person = shift.assigneeId ? ctx.memberById.get(shift.assigneeId) : undefined;
  const mine = shift.assigneeId === ctx.user.id;
  const live = shift.startsAt <= now && shift.endsAt > now;
  const past = shift.endsAt <= now;
  const time = formatTimeRange(shift.startsAt, shift.endsAt, tz, ctx.user.hour12);
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-xl border px-3 py-2.5",
        person
          ? "border-line bg-surface"
          : "border-dashed border-amber-400 bg-amber-50/70 dark:border-amber-700 dark:bg-amber-950/30",
        past && "opacity-60",
      )}
      data-testid="shift-item"
    >
      <span
        className={cn(
          "h-9 w-1 shrink-0 rounded-full",
          person ? colorClasses(person.color).bar : "bg-amber-400",
        )}
      />
      {person ? (
        <Avatar name={person.name} color={person.color} size="sm" />
      ) : (
        <span className="flex size-7 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
          <UserRoundX className="size-4" aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {person ? (mine ? "You" : person.name) : "Open shift"}
          {live && (
            <Badge tone="success" className="ml-2 align-middle">
              On duty
            </Badge>
          )}
        </p>
        <p className="tabular text-xs text-muted">
          {showDate && `${formatDate(shift.startsAt, tz, "medium")} · `}
          {time}
          {shift.note && <span className="text-faint"> · {shift.note}</span>}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {!person && !past && ctx.canEdit && (
          <ActionButton
            action={claimShift}
            fields={{ circleId: ctx.circle.id, shiftId: shift.id }}
            variant="primary"
            size="sm"
          >
            Take it
          </ActionButton>
        )}
        {mine && !past && (
          <ActionButton
            action={releaseShift}
            fields={{ circleId: ctx.circle.id, shiftId: shift.id }}
            variant="ghost"
            size="sm"
            confirm={{
              title: "Can’t make this shift?",
              body: `The shift (${time}) becomes open and everyone else is notified so someone can take it.`,
              confirmLabel: "Give up shift",
              danger: true,
            }}
          >
            Can’t make it
          </ActionButton>
        )}
        {ctx.canEdit && (
          <Link
            href={`/c/${ctx.circle.id}/schedule/shifts/${shift.id}`}
            className={buttonClasses(
              "ghost",
              "icon-sm",
              "text-faint opacity-70 group-hover:opacity-100",
            )}
            aria-label="Edit shift"
          >
            <Pencil aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}

export function GapItem({ gap, ctx, now }: { gap: Interval; ctx: CircleContext; now: Date }) {
  const tz = ctx.circle.timezone;
  const start = new Date(Math.max(gap.start, now.getTime()));
  const end = new Date(gap.end);
  const range = formatTimeRange(start, end, tz, ctx.user.hour12);
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-dashed border-red-300 bg-red-50/70 px-3 py-2.5 dark:border-red-800 dark:bg-red-950/30"
      data-testid="gap-item"
    >
      <span className="h-9 w-1 shrink-0 rounded-full bg-red-400" />
      <span className="flex size-7 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">
        <TriangleAlert className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-red-900 dark:text-red-200">Nobody on duty</p>
        <p className="tabular text-xs text-red-800/80 dark:text-red-300/80">
          {range} · {formatDuration(end.getTime() - start.getTime())}
        </p>
      </div>
      {ctx.canEdit && (
        <ActionButton
          action={coverGap}
          fields={{ circleId: ctx.circle.id, start: start.getTime(), end: gap.end }}
          variant="outline"
          size="sm"
          confirm={{
            title: "Cover this time?",
            body: `You’ll be on duty ${formatDate(start, tz, "medium")}, ${range}. You can adjust the shift afterwards.`,
            confirmLabel: "I’ll cover it",
          }}
        >
          I’ll cover
        </ActionButton>
      )}
    </div>
  );
}

export function AppointmentItem({
  appt,
  ctx,
  now,
  clashesWith = [],
  showDate = true,
}: {
  appt: AppointmentView;
  ctx: CircleContext;
  now: Date;
  clashesWith?: AppointmentView[];
  showDate?: boolean;
}) {
  const tz = ctx.circle.timezone;
  const Icon = kindIcon[appt.kind];
  const person = appt.assigneeId ? ctx.memberById.get(appt.assigneeId) : undefined;
  const cancelled = appt.status === "cancelled";
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-line bg-surface px-3 py-2.5",
        clashesWith.length > 0 && "border-amber-400 dark:border-amber-700",
        cancelled && "opacity-60",
      )}
      data-testid="appointment-item"
    >
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
        <Icon className="size-[1.1rem]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <Link
          href={`/c/${ctx.circle.id}/appointments/${appt.id}`}
          className={cn("text-sm font-medium hover:underline", cancelled && "line-through")}
        >
          {appt.title}
        </Link>
        <p className="tabular text-xs text-muted">
          {showDate && `${formatDate(appt.startsAt, tz, "medium")} · `}
          {formatTimeRange(appt.startsAt, appt.endsAt, tz, ctx.user.hour12)}
        </p>
        {appt.location && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-faint">
            <MapPin className="size-3 shrink-0" aria-hidden />
            {appt.location}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {person ? (
            <Badge tone="neutral">
              <Car aria-hidden />{" "}
              {person.userId === ctx.user.id
                ? "You’re going"
                : `${person.name.split(" ")[0]} is going`}
            </Badge>
          ) : (
            !cancelled && (
              <Badge tone="warning">
                <Car aria-hidden /> Nobody going yet
              </Badge>
            )
          )}
          {clashesWith.length > 0 && (
            <Badge tone="warning">
              <TriangleAlert aria-hidden /> Clashes with{" "}
              {clashesWith.map((c) => c.title).join(", ")}
            </Badge>
          )}
          {cancelled && <Badge tone="neutral">Cancelled</Badge>}
          {appt.status === "done" && <Badge tone="success">Done</Badge>}
        </div>
      </div>
      {!person && !cancelled && appt.status !== "done" && ctx.canEdit && appt.endsAt > now && (
        <ActionButton
          action={takeAppointment}
          fields={{ circleId: ctx.circle.id, appointmentId: appt.id }}
          size="sm"
        >
          I’ll go
        </ActionButton>
      )}
    </div>
  );
}
