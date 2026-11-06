"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { createCircle } from "@/lib/circles";
import { invalid, requiredText, text, timeString, timeZone, type FormState } from "@/lib/forms";

const schema = z.object({
  recipientName: requiredText(60, "Their name"),
  name: text(80, "Circle name"),
  relationship: text(40, "Relationship"),
  timezone: timeZone,
  coverage: z.enum(["day", "allday", "custom"]).default("day"),
  coverageStart: timeString.optional(),
  coverageEnd: timeString.optional(),
});

export async function createCircleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const d = parsed.data;
  const [coverageStart, coverageEnd] =
    d.coverage === "allday"
      ? ["00:00", "00:00"]
      : d.coverage === "custom"
        ? [d.coverageStart ?? "08:00", d.coverageEnd ?? "20:00"]
        : ["08:00", "20:00"];
  const id = createCircle({
    userId: user.id,
    recipientName: d.recipientName,
    name: d.name,
    relationship: d.relationship,
    timezone: d.timezone,
    coverageStart,
    coverageEnd,
  });
  redirect(`/c/${id}?welcome=1`);
}
