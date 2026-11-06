import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ui/client";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireCircle } from "@/lib/auth/dal";
import { getShift } from "@/lib/data";
import { canEdit } from "@/lib/roles";
import { localDateOf, localTimeOf, startOfWeek } from "@/lib/time";
import { deleteShift } from "../../actions";
import { ShiftForm } from "../../shift-form";

export const metadata: Metadata = { title: "Edit shift" };

export default async function EditShiftPage(
  props: PageProps<"/c/[circleId]/schedule/shifts/[shiftId]">,
) {
  const { circleId, shiftId } = await props.params;
  const ctx = await requireCircle(circleId, "edit");
  const shift = getShift(ctx, shiftId);
  if (!shift) notFound();
  const tz = ctx.circle.timezone;
  const date = localDateOf(shift.startsAt, tz);
  const canDelete =
    ctx.canAdmin || shift.createdBy === ctx.user.id || shift.assigneeId === ctx.user.id;
  return (
    <div className="mx-auto max-w-lg">
      <Link
        href={`/c/${circleId}/schedule?week=${startOfWeek(date)}`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
      >
        <ChevronLeft className="size-4" aria-hidden /> Schedule
      </Link>
      <PageHeader title="Edit shift" />
      <ShiftForm
        circleId={circleId}
        members={ctx.members.filter((m) => canEdit(m.role))}
        initial={{
          id: shift.id,
          date,
          start: localTimeOf(shift.startsAt, tz),
          end: localTimeOf(shift.endsAt, tz),
          assigneeId: shift.assigneeId ?? "",
          note: shift.note ?? "",
        }}
      />
      {canDelete && (
        <Card className="mt-8 border-red-200 dark:border-red-900">
          <CardHeader
            title="Remove shift"
            description={shift.seriesId ? "This shift repeats weekly." : undefined}
          />
          <CardBody className="flex flex-wrap gap-2">
            <ActionButton
              action={deleteShift}
              fields={{ circleId, shiftId: shift.id, scope: "one" }}
              variant="outline"
              className="text-red-600 dark:text-red-400"
              confirm={{ title: "Remove this shift?", confirmLabel: "Remove", danger: true }}
            >
              <Trash2 aria-hidden /> {shift.seriesId ? "Only this one" : "Remove shift"}
            </ActionButton>
            {shift.seriesId && (
              <ActionButton
                action={deleteShift}
                fields={{ circleId, shiftId: shift.id, scope: "future" }}
                variant="outline"
                className="text-red-600 dark:text-red-400"
                confirm={{
                  title: "Remove this and all later shifts in the series?",
                  confirmLabel: "Remove all",
                  danger: true,
                }}
              >
                <Trash2 aria-hidden /> This and following
              </ActionButton>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
