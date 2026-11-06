import Link from "next/link";
import {
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  HeartPulse,
  NotebookPen,
  PartyPopper,
  Pill,
  Plus,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { ActivityFeed } from "@/components/activity-feed";
import { DoseList, PrnList } from "@/components/doses";
import { JournalEntryCard } from "@/components/journal-entry";
import { AppointmentItem, GapItem, ShiftItem } from "@/components/schedule-items";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, Avatar, Badge, EmptyState } from "@/components/ui/misc";
import { recentActivity } from "@/lib/activity";
import { requireCircle } from "@/lib/auth/dal";
import { cn } from "@/lib/cn";
import { coverageGaps, findClashes, onDutyAt, type Interval } from "@/lib/coverage";
import {
  appointmentsBetween,
  dosesForDate,
  getProfile,
  latestHandoff,
  listMedications,
  listTasks,
  prnStatus,
  shiftsBetween,
} from "@/lib/data";
import { dosesPerDay, stockStatus } from "@/lib/meds";
import {
  DAY,
  addDays,
  dayBounds,
  formatDate,
  formatDateString,
  formatRelative,
  formatTime,
  greeting,
  todayIn,
} from "@/lib/time";

export default async function TodayPage(props: PageProps<"/c/[circleId]">) {
  const { circleId } = await props.params;
  const sp = await props.searchParams;
  const ctx = await requireCircle(circleId);
  const { circle, user } = ctx;
  const tz = circle.timezone;
  const now = new Date();
  const today = todayIn(tz, now);
  const base = `/c/${circle.id}`;

  const meds = listMedications(ctx);
  const doses = dosesForDate(ctx, today, now, meds);
  const prn = prnStatus(ctx, now, meds);
  const { start: dayStart } = dayBounds(today, tz);
  const shifts = shiftsBetween(
    ctx,
    new Date(dayStart.getTime() - DAY),
    new Date(now.getTime() + 8 * DAY),
  );
  const onDuty = onDutyAt(shifts, now);
  const nextShift = shifts.find((s) => s.startsAt > now && s.assigneeId);
  const gaps: Interval[] = [today, addDays(today, 1)]
    .flatMap((d) => coverageGaps(d, tz, circle, shifts))
    .filter((g) => g.end > now.getTime());
  const gapNow = gaps.find((g) => g.start <= now.getTime());
  const openShifts = shifts.filter((s) => !s.assigneeId && s.endsAt > now);
  const appts = appointmentsBetween(ctx, now, new Date(now.getTime() + 7 * DAY));
  const clashes = findClashes(appts);
  const unattended = appts.filter((a) => !a.assigneeId && a.status === "scheduled");
  const handoff = latestHandoff(ctx);
  const openTasks = listTasks(ctx).filter((t) => !t.doneAt);
  const myTasks = openTasks
    .filter((t) => !t.assigneeId || t.assigneeId === user.id || (t.dueDate && t.dueDate <= today))
    .slice(0, 5);
  const activityItems = recentActivity(
    { circleId: circle.id, cipher: ctx.cipher },
    tz,
    user.hour12,
    8,
  );
  const missed = doses.filter((d) => d.state === "missed");
  const lowStock = meds.filter((m) => {
    const s = stockStatus({
      stockCount: m.stockCount,
      stockAlertAt: m.stockAlertAt,
      doseQuantity: m.doseQuantity,
      perDay: dosesPerDay(m),
    });
    return s.level === "low" || s.level === "out";
  });
  const doneCount = doses.filter((d) => d.log).length;

  const setup = [
    { done: meds.length > 0, label: "Add medications", href: `${base}/meds/new`, icon: Pill },
    {
      done: ctx.members.length > 1,
      label: "Invite your family",
      href: `${base}/family`,
      icon: UserPlus,
    },
    {
      done: shifts.length > 0,
      label: "Plan who’s on duty",
      href: `${base}/schedule`,
      icon: UsersRound,
    },
    {
      done: !!getProfile(ctx).updatedAt,
      label: `Fill in ${circle.recipientName}’s care profile`,
      href: `${base}/profile/edit`,
      icon: HeartPulse,
    },
  ];
  const setupLeft = setup.filter((s) => !s.done).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-brand">{formatDate(now, tz, "long")}</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.7rem]">
            {greeting(now, tz)}, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-0.5 text-muted">
            Here’s how things look for {circle.recipientName} today.
          </p>
        </div>
        {ctx.canEdit && (
          <div className="flex gap-2">
            <ButtonLink href={`${base}/journal?compose=handoff`} variant="outline" size="sm">
              <NotebookPen aria-hidden /> Handoff
            </ButtonLink>
            <ButtonLink href={`${base}/appointments/new`} variant="outline" size="sm">
              <CalendarPlus aria-hidden /> Appointment
            </ButtonLink>
          </div>
        )}
      </header>

      {sp.welcome && (
        <Alert tone="success" title={`Your care circle for ${circle.recipientName} is ready`}>
          Start with the steps below. Everything can be changed later.
        </Alert>
      )}
      {sp.joined && (
        <Alert tone="success" title={`Welcome to ${circle.name}`}>
          You can now see the medication checklist, the schedule and the journal. Turn on reminders
          in{" "}
          <Link href="/settings" className="font-medium underline">
            your settings
          </Link>
          .
        </Alert>
      )}

      {/* Alerts that need someone to act */}
      <div className="space-y-2" aria-live="polite">
        {missed.length > 0 && (
          <Alert
            tone="danger"
            title={`${missed.length} dose${missed.length > 1 ? "s" : ""} not logged`}
            action={
              <Link href="#meds" className="text-sm font-medium underline">
                Review
              </Link>
            }
          >
            {missed
              .map((m) => `${m.med.name} (${formatTime(m.scheduledFor, tz, user.hour12)})`)
              .join(", ")}
            . If they were given, mark them now so nobody gives them twice.
          </Alert>
        )}
        {clashes.size > 0 && (
          <Alert tone="warning" title="Appointments overlap this week">
            {appts
              .filter((a) => clashes.has(a.id))
              .map((a) => a.title)
              .join(" and ")}{" "}
            are at the same time.{" "}
            <Link href={`${base}/schedule`} className="font-medium underline">
              Open schedule
            </Link>
          </Alert>
        )}
        {lowStock.length > 0 && (
          <Alert tone="warning" title="Refill soon">
            {lowStock.map((m) => `${m.name} (${m.stockCount} left)`).join(", ")}
          </Alert>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          {/* On duty */}
          <Card>
            <CardHeader
              title="Who’s on duty"
              icon={<ShieldCheck />}
              action={
                <Link
                  href={`${base}/schedule`}
                  className="text-sm font-medium text-brand hover:underline"
                >
                  Schedule
                </Link>
              }
            />
            <CardBody className="space-y-2">
              {onDuty.length > 0 ? (
                onDuty.map((s) => <ShiftItem key={s.id} shift={s} ctx={ctx} now={now} />)
              ) : gapNow ? (
                <GapItem gap={gapNow} ctx={ctx} now={now} />
              ) : (
                <p className="text-sm text-muted">
                  Nobody is scheduled right now, and none is needed.
                </p>
              )}
              {nextShift && (
                <p className="flex items-center gap-2 pt-1 text-sm text-muted">
                  <span>Next:</span>
                  <Avatar
                    name={ctx.memberById.get(nextShift.assigneeId!)?.name ?? "?"}
                    color={ctx.memberById.get(nextShift.assigneeId!)?.color}
                    size="xs"
                  />
                  <span className="font-medium text-fg">
                    {nextShift.assigneeId === user.id
                      ? "You"
                      : ctx.memberById.get(nextShift.assigneeId!)?.name}
                  </span>
                  {formatRelative(nextShift.startsAt, now)} (
                  {formatTime(nextShift.startsAt, tz, user.hour12)})
                </p>
              )}
              {(gaps.filter((g) => g !== gapNow).length > 0 || openShifts.length > 0) && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {gaps.filter((g) => g !== gapNow).length > 0 && (
                    <Link href={`${base}/schedule`}>
                      <Badge tone="danger">
                        {gaps.filter((g) => g !== gapNow).length} uncovered stretch
                        {gaps.filter((g) => g !== gapNow).length > 1 ? "es" : ""} in the next 2 days
                      </Badge>
                    </Link>
                  )}
                  {openShifts.length > 0 && (
                    <Link href={`${base}/schedule`}>
                      <Badge tone="warning">
                        {openShifts.length} open shift{openShifts.length > 1 ? "s" : ""} this week
                      </Badge>
                    </Link>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Medications */}
          <Card id="meds" className="scroll-mt-20 overflow-hidden">
            <CardHeader
              title="Medications today"
              description={
                doses.length > 0
                  ? `${doneCount} of ${doses.length} doses logged`
                  : meds.length > 0
                    ? "No scheduled doses today"
                    : undefined
              }
              icon={<Pill />}
              action={
                <Link
                  href={`${base}/meds`}
                  className="text-sm font-medium text-brand hover:underline"
                >
                  All meds
                </Link>
              }
            />
            {doses.length > 0 && (
              <div className="mx-4 mt-3 h-1.5 overflow-hidden rounded-full bg-subtle sm:mx-5">
                <div
                  className="h-full rounded-full bg-brand transition-[width]"
                  style={{ width: `${Math.round((doneCount / doses.length) * 100)}%` }}
                />
              </div>
            )}
            <div className="mt-3">
              {meds.length === 0 ? (
                <CardBody>
                  <EmptyState
                    icon={<Pill />}
                    title="No medications yet"
                    action={
                      ctx.canEdit && (
                        <ButtonLink href={`${base}/meds/new`} size="sm">
                          <Plus aria-hidden /> Add a medication
                        </ButtonLink>
                      )
                    }
                  >
                    Add each medication with its times, and everyone will share one checklist.
                  </EmptyState>
                </CardBody>
              ) : (
                <>
                  {doses.length > 0 && <DoseList items={doses} ctx={ctx} now={now} />}
                  {prn.length > 0 && (
                    <div className="border-t border-line">
                      <h3 className="bg-subtle/60 px-4 py-1.5 text-xs font-semibold tracking-wide text-muted uppercase sm:px-5">
                        As needed
                      </h3>
                      <PrnList items={prn} ctx={ctx} now={now} />
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          {setupLeft > 0 && ctx.canEdit && (
            <Card className="border-brand/30 bg-gradient-to-br from-brand-soft to-surface">
              <CardHeader
                title="Get set up"
                description={`${setup.length - setupLeft} of ${setup.length} done`}
                icon={<PartyPopper />}
              />
              <CardBody className="pt-3">
                <ul className="space-y-1">
                  {setup.map((s) => (
                    <li key={s.label}>
                      <Link
                        href={s.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-surface",
                          s.done && "text-muted line-through",
                        )}
                      >
                        {s.done ? (
                          <CheckCircle2 className="size-5 text-brand" aria-hidden />
                        ) : (
                          <Circle className="size-5 text-faint" aria-hidden />
                        )}
                        <span className="flex-1">{s.label}</span>
                        {!s.done && <ArrowRight className="size-4 text-faint" aria-hidden />}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Coming up"
              description="Next 7 days"
              icon={<CalendarPlus />}
              action={
                <Link
                  href={`${base}/appointments`}
                  className="text-sm font-medium text-brand hover:underline"
                >
                  All
                </Link>
              }
            />
            <CardBody className="space-y-2">
              {appts.length === 0 ? (
                <p className="text-sm text-muted">No appointments this week.</p>
              ) : (
                appts
                  .slice(0, 4)
                  .map((a) => (
                    <AppointmentItem
                      key={a.id}
                      appt={a}
                      ctx={ctx}
                      now={now}
                      clashesWith={(clashes.get(a.id) ?? [])
                        .map((id) => appts.find((x) => x.id === id)!)
                        .filter(Boolean)}
                    />
                  ))
              )}
              {unattended.length > 0 && (
                <p className="text-xs text-muted">
                  {unattended.length} appointment{unattended.length > 1 ? "s" : ""} still need
                  someone to go along.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Latest handoff"
              icon={<NotebookPen />}
              action={
                <Link
                  href={`${base}/journal`}
                  className="text-sm font-medium text-brand hover:underline"
                >
                  Journal
                </Link>
              }
            />
            <CardBody>
              {handoff ? (
                <JournalEntryCard entry={handoff} ctx={ctx} now={now} compact />
              ) : (
                <p className="text-sm text-muted">
                  No handoff notes yet. When your shift ends, leave one for whoever is next.
                </p>
              )}
            </CardBody>
          </Card>

          {myTasks.length > 0 && (
            <Card>
              <CardHeader
                title="To do"
                icon={<ClipboardCheck />}
                action={
                  <Link
                    href={`${base}/tasks`}
                    className="text-sm font-medium text-brand hover:underline"
                  >
                    All tasks
                  </Link>
                }
              />
              <CardBody>
                <ul className="space-y-2">
                  {myTasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-sm">
                      <Circle className="size-4 shrink-0 text-faint" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{t.title}</span>
                      {t.dueDate && (
                        <Badge
                          tone={
                            t.dueDate < today
                              ? "danger"
                              : t.dueDate === today
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {t.dueDate === today ? "Today" : formatDateString(t.dueDate, "short")}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Recent activity" />
            <CardBody>
              <ActivityFeed items={activityItems} ctx={ctx} now={now} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
