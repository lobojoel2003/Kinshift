import type { Metadata } from "next";
import { CalendarDays, Plus } from "lucide-react";
import { AppointmentItem } from "@/components/schedule-items";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader, SectionTitle } from "@/components/ui/misc";
import { requireCircle } from "@/lib/auth/dal";
import { findClashes } from "@/lib/coverage";
import { appointmentsBetween, pastAppointments } from "@/lib/data";
import { DAY } from "@/lib/time";

export const metadata: Metadata = { title: "Appointments" };

export default async function AppointmentsPage(props: PageProps<"/c/[circleId]/appointments">) {
  const { circleId } = await props.params;
  const ctx = await requireCircle(circleId);
  const now = new Date();
  const upcoming = appointmentsBetween(ctx, now, new Date(now.getTime() + 365 * DAY), {
    includeCancelled: true,
  });
  const clashes = findClashes(upcoming.filter((a) => a.status !== "cancelled"));
  const past = pastAppointments(ctx, now, 20);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Appointments"
        description={`Doctor visits, therapy and tests for ${ctx.circle.recipientName}.`}
        actions={
          ctx.canEdit && (
            <ButtonLink href={`/c/${circleId}/appointments/new`}>
              <Plus aria-hidden /> Add appointment
            </ButtonLink>
          )
        }
      />
      {upcoming.length === 0 && past.length === 0 ? (
        <EmptyState icon={<CalendarDays />} title="No appointments yet">
          Add upcoming visits so everyone knows when they are and who’s taking{" "}
          {ctx.circle.recipientName}.
        </EmptyState>
      ) : (
        <div className="space-y-8">
          <section>
            <SectionTitle>Upcoming · {upcoming.length}</SectionTitle>
            {upcoming.length === 0 ? (
              <p className="px-1 text-sm text-muted">Nothing scheduled.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((a) => (
                  <AppointmentItem
                    key={a.id}
                    appt={a}
                    ctx={ctx}
                    now={now}
                    clashesWith={(clashes.get(a.id) ?? [])
                      .map((id) => upcoming.find((x) => x.id === id)!)
                      .filter(Boolean)}
                  />
                ))}
              </div>
            )}
          </section>
          {past.length > 0 && (
            <section>
              <SectionTitle>Past</SectionTitle>
              <div className="space-y-2">
                {past.map((a) => (
                  <AppointmentItem key={a.id} appt={a} ctx={ctx} now={now} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
