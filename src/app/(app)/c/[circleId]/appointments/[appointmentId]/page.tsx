import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarCheck,
  CalendarX,
  Car,
  ChevronLeft,
  Clock,
  MapPin,
  NotebookPen,
  Pencil,
  RotateCcw,
  Stethoscope,
  Trash2,
} from "lucide-react";
import { kindIcon } from "@/components/schedule-items";
import { ActionButton } from "@/components/ui/client";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Alert, Avatar, Badge, PageHeader } from "@/components/ui/misc";
import { requireCircle } from "@/lib/auth/dal";
import { findClashes } from "@/lib/coverage";
import { appointmentsBetween, getAppointment } from "@/lib/data";
import { APPOINTMENT_KINDS } from "@/lib/domain";
import { DAY, formatDate, formatTimeRange } from "@/lib/time";
import { deleteAppointment, setAppointmentStatus, takeAppointment } from "../actions";

export async function generateMetadata(
  props: PageProps<"/c/[circleId]/appointments/[appointmentId]">,
): Promise<Metadata> {
  const { circleId, appointmentId } = await props.params;
  const ctx = await requireCircle(circleId);
  return { title: getAppointment(ctx, appointmentId)?.title ?? "Appointment" };
}

export default async function AppointmentPage(
  props: PageProps<"/c/[circleId]/appointments/[appointmentId]">,
) {
  const { circleId, appointmentId } = await props.params;
  const sp = await props.searchParams;
  const ctx = await requireCircle(circleId);
  const appt = getAppointment(ctx, appointmentId);
  if (!appt) notFound();
  const tz = ctx.circle.timezone;
  const now = new Date();
  const person = appt.assigneeId ? ctx.memberById.get(appt.assigneeId) : undefined;
  const Icon = kindIcon[appt.kind] ?? Stethoscope;
  const sameDay = appointmentsBetween(
    ctx,
    new Date(appt.startsAt.getTime() - DAY),
    new Date(appt.endsAt.getTime() + DAY),
  );
  const clashIds = findClashes(sameDay).get(appt.id) ?? [];
  const clashes = sameDay.filter((a) => clashIds.includes(a.id));
  const upcoming = appt.endsAt > now;
  const fields = { circleId, appointmentId: appt.id };

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/c/${circleId}/appointments`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
      >
        <ChevronLeft className="size-4" aria-hidden /> Appointments
      </Link>
      <PageHeader
        eyebrow={APPOINTMENT_KINDS.find((k) => k.value === appt.kind)?.label}
        title={appt.title}
        actions={
          ctx.canEdit && (
            <ButtonLink
              href={`/c/${circleId}/appointments/${appt.id}/edit`}
              variant="outline"
              size="sm"
            >
              <Pencil aria-hidden /> Edit
            </ButtonLink>
          )
        }
      />
      {sp.saved && (
        <Alert tone="success" className="mb-4">
          Saved. Everyone in the circle can see it on the schedule.
        </Alert>
      )}
      {clashes.length > 0 && appt.status !== "cancelled" && (
        <Alert tone="warning" title="This clashes with another appointment" className="mb-4">
          {clashes
            .map(
              (c) => `${c.title} (${formatTimeRange(c.startsAt, c.endsAt, tz, ctx.user.hour12)})`,
            )
            .join(", ")}
        </Alert>
      )}

      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
              <Icon className="size-5" aria-hidden />
            </span>
            <div>
              <p className="flex items-center gap-1.5 font-medium">
                <Clock className="size-4 text-muted" aria-hidden />
                {formatDate(appt.startsAt, tz, "long")}
              </p>
              <p className="tabular text-muted">
                {formatTimeRange(appt.startsAt, appt.endsAt, tz, ctx.user.hour12)}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {appt.status === "cancelled" && <Badge tone="neutral">Cancelled</Badge>}
                {appt.status === "done" && <Badge tone="success">Done</Badge>}
              </div>
            </div>
          </div>
          {appt.location && (
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
              <a
                className="underline-offset-2 hover:underline"
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(appt.location)}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                {appt.location}
              </a>
            </p>
          )}
          {appt.provider && (
            <p className="flex items-center gap-2">
              <Stethoscope className="size-4 text-muted" aria-hidden /> {appt.provider}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-subtle p-3">
            <p className="flex items-center gap-2 text-sm">
              <Car className="size-4 text-muted" aria-hidden />
              {person ? (
                <>
                  <Avatar name={person.name} color={person.color} size="xs" />
                  <span>
                    <strong>
                      {person.userId === ctx.user.id ? "You are" : `${person.name} is`}
                    </strong>{" "}
                    going with {ctx.circle.recipientName}
                  </span>
                </>
              ) : (
                <span className="text-amber-800 dark:text-amber-300">
                  Nobody is going with {ctx.circle.recipientName} yet
                </span>
              )}
            </p>
            {!person && upcoming && appt.status === "scheduled" && ctx.canEdit && (
              <ActionButton action={takeAppointment} fields={fields} variant="primary">
                I’ll go
              </ActionButton>
            )}
          </div>
          {appt.notes && (
            <div>
              <p className="mb-1 text-sm font-medium text-muted">Notes</p>
              <p className="whitespace-pre-wrap">{appt.notes}</p>
            </div>
          )}
        </CardBody>
      </Card>

      {ctx.canEdit && (
        <div className="mt-5 flex flex-wrap gap-2">
          {appt.status === "scheduled" && (
            <>
              <ActionButton action={setAppointmentStatus} fields={{ ...fields, status: "done" }}>
                <CalendarCheck aria-hidden /> Mark as done
              </ActionButton>
              <ActionButton
                action={setAppointmentStatus}
                fields={{ ...fields, status: "cancelled" }}
                confirm={{
                  title: "Cancel this appointment?",
                  body: "It stays in the history and the family is told.",
                  confirmLabel: "Cancel appointment",
                  danger: true,
                }}
              >
                <CalendarX aria-hidden /> Cancel
              </ActionButton>
            </>
          )}
          {appt.status !== "scheduled" && (
            <ActionButton action={setAppointmentStatus} fields={{ ...fields, status: "scheduled" }}>
              <RotateCcw aria-hidden /> Back to scheduled
            </ActionButton>
          )}
          <ButtonLink href={`/c/${circleId}/journal?compose=note`} variant="outline" size="sm">
            <NotebookPen aria-hidden /> Write visit notes
          </ButtonLink>
          {(ctx.canAdmin || appt.createdBy === ctx.user.id) && (
            <ActionButton
              action={deleteAppointment}
              fields={fields}
              variant="ghost"
              className="text-red-600 dark:text-red-400"
              confirm={{
                title: "Delete this appointment?",
                body: "It will be removed completely. To keep a record, cancel it instead.",
                confirmLabel: "Delete",
                danger: true,
              }}
            >
              <Trash2 aria-hidden /> Delete
            </ActionButton>
          )}
        </div>
      )}
    </div>
  );
}
