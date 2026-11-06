import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { requireCircle } from "@/lib/auth/dal";
import { getAppointment } from "@/lib/data";
import { canEdit } from "@/lib/roles";
import { localDateOf, localTimeOf } from "@/lib/time";
import { AppointmentForm } from "../../appointment-form";

export const metadata: Metadata = { title: "Edit appointment" };

export default async function EditAppointmentPage(
  props: PageProps<"/c/[circleId]/appointments/[appointmentId]/edit">,
) {
  const { circleId, appointmentId } = await props.params;
  const ctx = await requireCircle(circleId, "edit");
  const appt = getAppointment(ctx, appointmentId);
  if (!appt) notFound();
  const tz = ctx.circle.timezone;
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/c/${circleId}/appointments/${appt.id}`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
      >
        <ChevronLeft className="size-4" aria-hidden /> {appt.title}
      </Link>
      <PageHeader title="Edit appointment" />
      <AppointmentForm
        circleId={circleId}
        members={ctx.members.filter((m) => canEdit(m.role))}
        initial={{
          id: appt.id,
          title: appt.title,
          kind: appt.kind,
          date: localDateOf(appt.startsAt, tz),
          start: localTimeOf(appt.startsAt, tz),
          end: localTimeOf(appt.endsAt, tz),
          location: appt.location,
          provider: appt.provider,
          notes: appt.notes,
          assigneeId: appt.assigneeId ?? "",
        }}
      />
    </div>
  );
}
