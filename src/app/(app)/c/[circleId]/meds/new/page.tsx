import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { requireCircle } from "@/lib/auth/dal";
import { todayIn } from "@/lib/time";
import { MedForm } from "../med-form";

export const metadata: Metadata = { title: "Add medication" };

export default async function NewMedicationPage(props: PageProps<"/c/[circleId]/meds/new">) {
  const { circleId } = await props.params;
  const ctx = await requireCircle(circleId, "edit");
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/c/${circleId}/meds`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
      >
        <ChevronLeft className="size-4" aria-hidden /> Medications
      </Link>
      <PageHeader
        title="Add a medication"
        description={`Times are in ${ctx.circle.recipientName}’s time zone (${ctx.circle.timezone.replaceAll("_", " ")}).`}
      />
      <MedForm
        circleId={circleId}
        initial={{
          name: "",
          dosage: "",
          purpose: "",
          instructions: "",
          prescriber: "",
          scheduleType: "scheduled",
          times: ["08:00"],
          days: [],
          startDate: todayIn(ctx.circle.timezone),
          endDate: "",
          minIntervalHours: "",
          maxPerDay: "",
          doseQuantity: "1",
          stockCount: "",
          stockAlertAt: "",
          color: "teal",
        }}
      />
    </div>
  );
}
