import Link from "next/link";
import { Check, Clock, Pill, SkipForward, TriangleAlert, Undo2 } from "lucide-react";
import { givePrnDose, logDose, undoDose } from "@/app/(app)/c/[circleId]/meds/actions";
import { ActionButton } from "@/components/ui/client";
import { Avatar, Badge } from "@/components/ui/misc";
import type { CircleContext } from "@/lib/auth/dal";
import { cn } from "@/lib/cn";
import { colorClasses } from "@/lib/colors";
import type { PrnItem } from "@/lib/data";
import type { DoseItem } from "@/lib/domain";
import { timeOfDayLabel, type DoseState } from "@/lib/meds";
import { HOUR, formatRelative, formatTime, localTimeOf } from "@/lib/time";
import { PrnGiveButton } from "./prn-give-button";

const stateBadge: Record<
  DoseState,
  { tone: "neutral" | "brand" | "success" | "warning" | "danger"; label: string }
> = {
  upcoming: { tone: "neutral", label: "Upcoming" },
  due: { tone: "brand", label: "Due now" },
  late: { tone: "warning", label: "Late" },
  missed: { tone: "danger", label: "Missed" },
  given: { tone: "success", label: "Given" },
  skipped: { tone: "neutral", label: "Skipped" },
};

export function DoseRow({ item, ctx, now }: { item: DoseItem; ctx: CircleContext; now: Date }) {
  const tz = ctx.circle.timezone;
  const h12 = ctx.user.hour12;
  const { med, log, state, scheduledFor } = item;
  const recorder = log?.recordedBy ? ctx.memberById.get(log.recordedBy) : undefined;
  const canUndo =
    !!log &&
    ctx.canEdit &&
    (log.recordedBy === ctx.user.id || ctx.canAdmin) &&
    now.getTime() - log.takenAt.getTime() < 24 * HOUR;
  const fields = {
    circleId: ctx.circle.id,
    medicationId: med.id,
    scheduledFor: scheduledFor.getTime(),
  };
  const color = colorClasses(med.color);

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5",
        state === "missed" && "bg-red-50/60 dark:bg-red-950/20",
      )}
      data-testid="dose-row"
      data-state={state}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          state === "given"
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
            : color.soft,
        )}
      >
        {state === "given" ? (
          <Check className="size-5" aria-hidden />
        ) : (
          <Pill className="size-5" aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Link href={`/c/${ctx.circle.id}/meds/${med.id}`} className="font-medium hover:underline">
            {med.name}
          </Link>
          {med.dosage && <span className="text-sm text-muted">{med.dosage}</span>}
        </div>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
          <span className="tabular inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            {formatTime(scheduledFor, tz, h12)}
          </span>
          {log ? (
            <span className="inline-flex items-center gap-1.5">
              {recorder && <Avatar name={recorder.name} color={recorder.color} size="xs" />}
              {log.status === "given" ? "Given" : "Skipped"} by{" "}
              {recorder?.name.split(" ")[0] ?? "someone"} at {formatTime(log.takenAt, tz, h12)}
            </span>
          ) : (
            med.instructions && <span className="line-clamp-1">{med.instructions}</span>
          )}
        </p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {!log && (
          <Badge tone={stateBadge[state].tone}>
            {state === "missed" && <TriangleAlert aria-hidden />}
            {stateBadge[state].label}
          </Badge>
        )}
        {log?.status === "skipped" && <Badge tone="neutral">Skipped</Badge>}
        {!log && ctx.canEdit && (
          <>
            <ActionButton
              action={logDose}
              fields={{ ...fields, status: "skipped" }}
              variant="ghost"
              size="icon-sm"
              title={`Skip the ${formatTime(scheduledFor, tz, h12)} dose of ${med.name}`}
              confirm={{
                title: `Skip this dose of ${med.name}?`,
                body: "Use this when the dose was intentionally not given, for example on a doctor’s advice. Everyone will see it was skipped.",
                confirmLabel: "Skip dose",
              }}
            >
              <SkipForward aria-hidden />
            </ActionButton>
            <ActionButton
              action={logDose}
              fields={{ ...fields, status: "given" }}
              variant={state === "upcoming" ? "outline" : "primary"}
              size="sm"
              disabled={scheduledFor.getTime() - now.getTime() > 2 * HOUR}
            >
              <Check aria-hidden />
              Given
            </ActionButton>
          </>
        )}
        {canUndo && (
          <ActionButton
            action={undoDose}
            fields={{ circleId: ctx.circle.id, logId: log!.id }}
            variant="ghost"
            size="sm"
            confirm={{
              title: "Undo this entry?",
              body: `This removes the record that ${med.name} was ${log!.status} at ${formatTime(log!.takenAt, tz, h12)}.`,
              confirmLabel: "Undo",
              danger: true,
            }}
          >
            <Undo2 aria-hidden />
            Undo
          </ActionButton>
        )}
      </div>
    </li>
  );
}

/** Today's doses grouped into morning, afternoon, evening and night. */
export function DoseList({
  items,
  ctx,
  now,
}: {
  items: DoseItem[];
  ctx: CircleContext;
  now: Date;
}) {
  const groups = new Map<string, DoseItem[]>();
  for (const item of items) {
    const label = timeOfDayLabel(localTimeOf(item.scheduledFor, ctx.circle.timezone));
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }
  return (
    <div className="divide-y divide-line">
      {[...groups].map(([label, group]) => {
        const done = group.filter((g) => g.log).length;
        return (
          <section key={label} aria-label={label}>
            <h3 className="flex items-center justify-between bg-subtle/60 px-4 py-1.5 text-xs font-semibold tracking-wide text-muted uppercase sm:px-5">
              {label}
              <span className="tabular font-medium normal-case">
                {done}/{group.length} done
              </span>
            </h3>
            <ul className="divide-y divide-line">
              {group.map((item) => (
                <DoseRow
                  key={`${item.med.id}:${item.scheduledFor.getTime()}`}
                  item={item}
                  ctx={ctx}
                  now={now}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function PrnList({ items, ctx, now }: { items: PrnItem[]; ctx: CircleContext; now: Date }) {
  const tz = ctx.circle.timezone;
  return (
    <ul className="divide-y divide-line">
      {items.map(({ med, lastGiven, givenInLast24h, check }) => {
        const by = lastGiven?.recordedBy ? ctx.memberById.get(lastGiven.recordedBy) : undefined;
        return (
          <li
            key={med.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5"
            data-testid="prn-row"
          >
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                colorClasses(med.color).soft,
              )}
            >
              <Pill className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 basis-48">
              <p className="font-medium">
                <Link href={`/c/${ctx.circle.id}/meds/${med.id}`} className="hover:underline">
                  {med.name}
                </Link>{" "}
                {med.dosage && <span className="text-sm font-normal text-muted">{med.dosage}</span>}
              </p>
              <p className="text-sm text-muted">
                {lastGiven
                  ? `Last given ${formatRelative(lastGiven.takenAt, now)} (${formatTime(lastGiven.takenAt, tz, ctx.user.hour12)})${by ? ` by ${by.name.split(" ")[0]}` : ""}`
                  : "Not given recently"}
                {med.maxPerDay ? ` · ${givenInLast24h}/${med.maxPerDay} in 24h` : ""}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {!check.allowed && (
                <Badge tone="warning">
                  {check.reason === "interval"
                    ? `Wait until ${formatTime(check.nextAllowedAt, tz, ctx.user.hour12)}`
                    : "Daily max reached"}
                </Badge>
              )}
              {ctx.canEdit && (
                <PrnGiveButton
                  action={givePrnDose}
                  circleId={ctx.circle.id}
                  medicationId={med.id}
                  medName={med.name}
                  allowed={check.allowed}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
