import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { requireCircle } from "@/lib/auth/dal";
import { canEdit } from "@/lib/roles";
import { addDays, isDateString, todayIn } from "@/lib/time";
import { AppointmentForm } from "../appointment-form";

export const metadata: Metadata = { title: "Add appointment" };

export default async function NewAppointmentPage(
  props: PageProps<"/c/[circleId]/appointments/new">,
) {
  const { circleId } = await props.params;
  const sp = await props.searchParams;
  const ctx = await requireCircle(circleId, "edit");
  const date =
    typeof sp.date === "string" && isDateString(sp.date)
      ? sp.date
      : addDays(todayIn(ctx.circle.timezone), 1);
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/c/${circleId}/appointments`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
      >
        <ChevronLeft className="size-4" aria-hidden /> Appointments
      </Link>
      <PageHeader
        title="Add an appointment"
        description="Kinshift warns you if it clashes with another one."
      />
      <AppointmentForm
        circleId={circleId}
        members={ctx.members.filter((m) => canEdit(m.role))}
        initial={{
          title: "",
          kind: "doctor",
          date,
          start: "10:00",
          end: "11:00",
          location: "",
          provider: "",
          notes: "",
          assigneeId: "",
        }}
      />
    </div>
  );
}
