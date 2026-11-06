import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Package, Pill, Plus } from "lucide-react";
import { DoseList, PrnList } from "@/components/doses";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, Badge, EmptyState, PageHeader, SectionTitle } from "@/components/ui/misc";
import { requireCircle, type CircleContext } from "@/lib/auth/dal";
import { cn } from "@/lib/cn";
import { colorClasses } from "@/lib/colors";
import { adherenceFor, dosesForDate, listMedications, prnStatus } from "@/lib/data";
import type { MedicationView } from "@/lib/domain";
import { describeSchedule, dosesPerDay, stockStatus } from "@/lib/meds";
import { formatDateString, todayIn } from "@/lib/time";

export const metadata: Metadata = { title: "Medications" };

function MedCard({
  med,
  ctx,
  adherence,
}: {
  med: MedicationView;
  ctx: CircleContext;
  adherence?: { percent: number | null; expected: number };
}) {
  const stock = stockStatus({
    stockCount: med.stockCount,
    stockAlertAt: med.stockAlertAt,
    doseQuantity: med.doseQuantity,
    perDay: dosesPerDay(med),
  });
  return (
    <Link
      href={`/c/${ctx.circle.id}/meds/${med.id}`}
      className="group flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-line-strong"
      data-testid="med-card"
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          colorClasses(med.color).soft,
        )}
      >
        <Pill className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {med.name} {med.dosage && <span className="font-normal text-muted">· {med.dosage}</span>}
        </p>
        <p className="text-sm text-muted">{describeSchedule(med, ctx.user.hour12)}</p>
        {med.purpose && <p className="text-sm text-faint">For {med.purpose.toLowerCase()}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {!med.active && <Badge tone="neutral">Stopped</Badge>}
          {med.endDate && med.active && (
            <Badge tone="info">Until {formatDateString(med.endDate, "short")}</Badge>
          )}
          {stock.level === "low" && (
            <Badge tone="warning">
              <Package aria-hidden /> {med.stockCount} left
              {stock.daysLeft !== null ? ` · ~${stock.daysLeft} days` : ""}
            </Badge>
          )}
          {stock.level === "out" && (
            <Badge tone="danger">
              <Package aria-hidden /> Out of stock
            </Badge>
          )}
          {stock.level === "ok" && (
            <Badge tone="neutral">
              <Package aria-hidden /> {med.stockCount} on hand
            </Badge>
          )}
          {adherence && adherence.percent !== null && (
            <Badge
              tone={
                adherence.percent >= 90 ? "success" : adherence.percent >= 70 ? "warning" : "danger"
              }
            >
              {adherence.percent}% given, last 7 days
            </Badge>
          )}
        </div>
      </div>
      <ChevronRight
        className="mt-3 size-4 text-faint transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

export default async function MedsPage(props: PageProps<"/c/[circleId]/meds">) {
  const { circleId } = await props.params;
  const sp = await props.searchParams;
  const ctx = await requireCircle(circleId);
  const now = new Date();
  const all = listMedications(ctx, { includeInactive: true });
  const active = all.filter((m) => m.active);
  const stopped = all.filter((m) => !m.active);
  const doses = dosesForDate(ctx, todayIn(ctx.circle.timezone, now), now, active);
  const prn = prnStatus(ctx, now, active);
  const adherence = adherenceFor(ctx, active, 7, now);
  const added = typeof sp.added === "string" ? all.find((m) => m.id === sp.added) : undefined;

  return (
    <div>
      <PageHeader
        title="Medications"
        description={`Everything ${ctx.circle.recipientName} takes, and what’s been given today.`}
        actions={
          ctx.canEdit && (
            <ButtonLink href={`/c/${circleId}/meds/new`}>
              <Plus aria-hidden /> Add medication
            </ButtonLink>
          )
        }
      />
      {added && (
        <Alert tone="success" title={`${added.name} added`} className="mb-5">
          It now appears on everyone’s checklist. {describeSchedule(added, ctx.user.hour12)}.
        </Alert>
      )}

      {all.length === 0 ? (
        <EmptyState
          icon={<Pill />}
          title="No medications yet"
          action={
            ctx.canEdit && (
              <ButtonLink href={`/c/${circleId}/meds/new`}>
                <Plus aria-hidden /> Add the first one
              </ButtonLink>
            )
          }
        >
          Add each medication with its dose times. Your family will share one checklist, and
          Kinshift will stop anyone logging the same dose twice.
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card className="h-fit overflow-hidden">
            <CardHeader
              title="Today’s checklist"
              description={`${doses.filter((d) => d.log).length} of ${doses.length} logged`}
            />
            <div className="mt-3">
              {doses.length > 0 ? (
                <DoseList items={doses} ctx={ctx} now={now} />
              ) : (
                <CardBody className="text-sm text-muted">No scheduled doses today.</CardBody>
              )}
              {prn.length > 0 && (
                <div className="border-t border-line">
                  <h3 className="bg-subtle/60 px-4 py-1.5 text-xs font-semibold tracking-wide text-muted uppercase sm:px-5">
                    As needed
                  </h3>
                  <PrnList items={prn} ctx={ctx} now={now} />
                </div>
              )}
            </div>
          </Card>

          <div className="space-y-3">
            <SectionTitle>Current medications · {active.length}</SectionTitle>
            {active.map((m) => (
              <MedCard key={m.id} med={m} ctx={ctx} adherence={adherence.get(m.id)} />
            ))}
            {stopped.length > 0 && (
              <details className="group pt-2">
                <summary className="cursor-pointer list-none px-1 text-sm font-medium text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
                  <ChevronRight
                    className="mr-1 inline size-4 transition-transform group-open:rotate-90"
                    aria-hidden
                  />
                  Stopped medications ({stopped.length})
                </summary>
                <div className="mt-3 space-y-3">
                  {stopped.map((m) => (
                    <MedCard key={m.id} med={m} ctx={ctx} />
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
