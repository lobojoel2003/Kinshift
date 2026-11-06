import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { requireCircle } from "@/lib/auth/dal";
import { getMedication } from "@/lib/data";
import { MedForm } from "../../med-form";

export const metadata: Metadata = { title: "Edit medication" };

export default async function EditMedicationPage(
  props: PageProps<"/c/[circleId]/meds/[medId]/edit">,
) {
  const { circleId, medId } = await props.params;
  const ctx = await requireCircle(circleId, "edit");
  const med = getMedication(ctx, medId);
  if (!med) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/c/${circleId}/meds/${medId}`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
      >
        <ChevronLeft className="size-4" aria-hidden /> {med.name}
      </Link>
      <PageHeader
        title={`Edit ${med.name}`}
        description="Changes apply to future doses. Past doses keep their history."
      />
      <MedForm
        circleId={circleId}
        initial={{
          id: med.id,
          name: med.name,
          dosage: med.dosage,
          purpose: med.purpose,
          instructions: med.instructions,
          prescriber: med.prescriber,
          scheduleType: med.scheduleType,
          times: med.times,
          days: med.daysOfWeek ?? [],
          startDate: med.startDate,
          endDate: med.endDate ?? "",
          minIntervalHours: med.minIntervalMinutes ? String(med.minIntervalMinutes / 60) : "",
          maxPerDay: med.maxPerDay ? String(med.maxPerDay) : "",
          doseQuantity: String(med.doseQuantity),
          stockCount: med.stockCount !== null ? String(med.stockCount) : "",
          stockAlertAt: med.stockAlertAt !== null ? String(med.stockAlertAt) : "",
          color: med.color,
        }}
      />
    </div>
  );
}
