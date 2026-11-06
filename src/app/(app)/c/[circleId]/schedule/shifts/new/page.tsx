import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { requireCircle } from "@/lib/auth/dal";
import { canEdit } from "@/lib/roles";
import { isDateString, isTimeString, todayIn } from "@/lib/time";
import { ShiftForm } from "../../shift-form";

export const metadata: Metadata = { title: "Add a shift" };

export default async function NewShiftPage(props: PageProps<"/c/[circleId]/schedule/shifts/new">) {
  const { circleId } = await props.params;
  const sp = await props.searchParams;
  const ctx = await requireCircle(circleId, "edit");
  const date =
    typeof sp.date === "string" && isDateString(sp.date) ? sp.date : todayIn(ctx.circle.timezone);
  const start =
    typeof sp.start === "string" && isTimeString(sp.start) ? sp.start : ctx.circle.coverageStart;
  const end =
    typeof sp.end === "string" && isTimeString(sp.end)
      ? sp.end
      : ctx.circle.coverageEnd === ctx.circle.coverageStart
        ? "20:00"
        : ctx.circle.coverageEnd;
  return (
    <div className="mx-auto max-w-lg">
      <Link
        href={`/c/${circleId}/schedule?week=${date}`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
      >
        <ChevronLeft className="size-4" aria-hidden /> Schedule
      </Link>
      <PageHeader
        title="Add a shift"
        description={`Times are in ${ctx.circle.timezone.replaceAll("_", " ")}.`}
      />
      <ShiftForm
        circleId={circleId}
        members={ctx.members.filter((m) => canEdit(m.role))}
        initial={{ date, start, end, assigneeId: ctx.canEdit ? ctx.user.id : "", note: "" }}
      />
    </div>
  );
}
