import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronLeft, Pause, Pencil, Play, SkipForward, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ui/client";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, Avatar, Badge, PageHeader, Stat } from "@/components/ui/misc";
import { requireCircle } from "@/lib/auth/dal";
import { adherenceFor, getMedication, medicationHistory } from "@/lib/data";
import { describeSchedule, dosesPerDay, stockStatus } from "@/lib/meds";
import { formatDateString, formatDateTime, formatTime } from "@/lib/time";
import { deleteMedication, setMedicationActive } from "../actions";
import { RestockForm } from "./restock-form";

export async function generateMetadata(
  props: PageProps<"/c/[circleId]/meds/[medId]">,
): Promise<Metadata> {
  const { circleId, medId } = await props.params;
  const ctx = await requireCircle(circleId);
  return { title: getMedication(ctx, medId)?.name ?? "Medication" };
}

export default async function MedicationPage(props: PageProps<"/c/[circleId]/meds/[medId]">) {
  const { circleId, medId } = await props.params;
  const sp = await props.searchParams;
  const ctx = await requireCircle(circleId);
  const med = getMedication(ctx, medId);
  if (!med) notFound();
  const now = new Date();
  const tz = ctx.circle.timezone;
  const history = medicationHistory(ctx, med.id, 40);
  const week = adherenceFor(ctx, [med], 7, now).get(med.id);
  const month = adherenceFor(ctx, [med], 30, now).get(med.id);
  const stock = stockStatus({
    stockCount: med.stockCount,
    stockAlertAt: med.stockAlertAt,
    doseQuantity: med.doseQuantity,
    perDay: dosesPerDay(med),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/c/${circleId}/meds`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
      >
        <ChevronLeft className="size-4" aria-hidden /> Medications
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {med.name}
            {!med.active && <Badge tone="neutral">Stopped</Badge>}
          </span>
        }
        description={[med.dosage, describeSchedule(med, ctx.user.hour12)]
          .filter(Boolean)
          .join(" · ")}
        actions={
          ctx.canEdit && (
            <>
              <ButtonLink href={`/c/${circleId}/meds/${med.id}/edit`} variant="outline" size="sm">
                <Pencil aria-hidden /> Edit
              </ButtonLink>
              <ActionButton
                action={setMedicationActive}
                fields={{ circleId, medicationId: med.id, active: med.active ? "0" : "1" }}
                confirm={
                  med.active
                    ? {
                        title: `Stop ${med.name}?`,
                        body: "It disappears from the daily checklist. Its history is kept and you can restart it any time.",
                        confirmLabel: "Stop medication",
                      }
                    : undefined
                }
              >
                {med.active ? <Pause aria-hidden /> : <Play aria-hidden />}
                {med.active ? "Stop" : "Restart"}
              </ActionButton>
              {ctx.canAdmin && (
                <ActionButton
                  action={deleteMedication}
                  fields={{ circleId, medicationId: med.id }}
                  variant="ghost"
                  title="Delete medication"
                  className="text-red-600 dark:text-red-400"
                  confirm={{
                    title: `Delete ${med.name} permanently?`,
                    body: "This also deletes its whole dose history. To keep the history, stop it instead.",
                    confirmLabel: "Delete forever",
                    danger: true,
                  }}
                >
                  <Trash2 aria-hidden />
                </ActionButton>
              )}
            </>
          )
        }
      />
      {sp.saved && (
        <Alert tone="success" className="mb-5">
          Changes saved.
        </Alert>
      )}

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Details" />
          <CardBody>
            <dl className="space-y-3 text-sm">
              {[
                ["Instructions", med.instructions],
                ["For", med.purpose],
                ["Prescribed by", med.prescriber],
                ["Started", formatDateString(med.startDate, "long")],
                ["Ends", med.endDate ? formatDateString(med.endDate, "long") : ""],
              ]
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-muted">{label}</dt>
                    <dd className="whitespace-pre-wrap">{value}</dd>
                  </div>
                ))}
            </dl>
          </CardBody>
        </Card>

        <div className="space-y-5">
          {med.scheduleType === "scheduled" && (
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="Given, last 7 days"
                value={
                  week?.percent !== null && week?.percent !== undefined ? `${week.percent}%` : "–"
                }
                hint={week ? `${week.given} of ${week.expected} doses` : undefined}
                tone={
                  week?.percent === null || week?.percent === undefined
                    ? undefined
                    : week.percent >= 90
                      ? "success"
                      : "warning"
                }
              />
              <Stat
                label="Given, last 30 days"
                value={
                  month?.percent !== null && month?.percent !== undefined
                    ? `${month.percent}%`
                    : "–"
                }
                hint={month ? `${month.given} of ${month.expected} doses` : undefined}
              />
            </div>
          )}
          <Card>
            <CardHeader
              title="Supply"
              description={
                stock.level === "untracked"
                  ? "Not tracked. Enter how many are on hand to get refill reminders."
                  : `${med.stockCount} on hand${stock.daysLeft !== null ? `, about ${stock.daysLeft} days` : ""}`
              }
              action={
                stock.level === "low" ? (
                  <Badge tone="warning">Refill soon</Badge>
                ) : stock.level === "out" ? (
                  <Badge tone="danger">Out</Badge>
                ) : null
              }
            />
            {ctx.canEdit && (
              <CardBody>
                <RestockForm
                  circleId={circleId}
                  medicationId={med.id}
                  tracked={stock.level !== "untracked"}
                />
              </CardBody>
            )}
          </Card>
        </div>
      </div>

      <Card className="mt-5">
        <CardHeader title="History" description="The last 40 entries" />
        <CardBody>
          {history.length === 0 ? (
            <p className="text-sm text-muted">Nothing logged yet.</p>
          ) : (
            <ol className="divide-y divide-line">
              {history.map((h) => {
                const by = h.recordedBy ? ctx.memberById.get(h.recordedBy) : undefined;
                return (
                  <li key={h.id} className="flex items-start gap-3 py-2.5 text-sm">
                    <span
                      className={
                        h.status === "given"
                          ? "mt-0.5 flex size-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "mt-0.5 flex size-6 items-center justify-center rounded-full bg-subtle text-muted"
                      }
                    >
                      {h.status === "given" ? (
                        <Check className="size-3.5" aria-hidden />
                      ) : (
                        <SkipForward className="size-3.5" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p>
                        <span className="font-medium">
                          {h.status === "given" ? "Given" : "Skipped"}
                        </span>{" "}
                        {h.scheduledFor ? (
                          <span className="text-muted">
                            ({formatTime(h.scheduledFor, tz, ctx.user.hour12)} dose)
                          </span>
                        ) : (
                          <span className="text-muted">(as needed)</span>
                        )}
                      </p>
                      {h.note && <p className="text-muted">“{h.note}”</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                      {by && <Avatar name={by.name} color={by.color} size="xs" />}
                      {formatDateTime(h.takenAt, tz, ctx.user.hour12)}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
