"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { circleAction } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { getDb } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import type { ProfileData } from "@/lib/domain";
import { invalid, optionalDate, text, type FormState } from "@/lib/forms";

const schema = z.object({
  preferredName: text(80, "Preferred name"),
  dateOfBirth: optionalDate,
  pronouns: text(30, "Pronouns"),
  conditions: text(2000, "Conditions"),
  allergies: text(1000, "Allergies"),
  bloodType: z.enum(["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"]).default(""),
  medicalNotes: text(3000, "Medical notes"),
  mobility: text(1000, "Mobility"),
  diet: text(1000, "Diet"),
  communication: text(1000, "Communication"),
  routines: text(2000, "Routines"),
  advanceDirective: text(1000, "Advance directive"),
  insurance: text(500, "Insurance"),
  pharmacy: text(300, "Pharmacy"),
});

const entry = z.object({ name: text(80), b: text(80), phone: text(40) });

function rows(formData: FormData, prefix: string, bKey: string) {
  const names = formData.getAll(`${prefix}Name`).map(String);
  const bs = formData.getAll(`${prefix}${bKey}`).map(String);
  const phones = formData.getAll(`${prefix}Phone`).map(String);
  return names
    .map((name, i) => entry.parse({ name, b: bs[i] ?? "", phone: phones[i] ?? "" }))
    .filter((r) => r.name || r.phone)
    .slice(0, 12);
}

export async function saveProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "edit", (ctx) => {
    const parsed = schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error, formData);
    const data: ProfileData = {
      ...parsed.data,
      dateOfBirth: parsed.data.dateOfBirth ?? "",
      providers: rows(formData, "provider", "Specialty").map((r) => ({
        name: r.name,
        specialty: r.b,
        phone: r.phone,
      })),
      emergencyContacts: rows(formData, "contact", "Relation").map((r) => ({
        name: r.name,
        relation: r.b,
        phone: r.phone,
      })),
    };
    const now = new Date();
    const dataEnc = ctx.cipher.encJson("profile.data", data);
    getDb()
      .insert(profiles)
      .values({ circleId: ctx.circle.id, dataEnc, updatedAt: now, updatedBy: ctx.user.id })
      .onConflictDoUpdate({
        target: profiles.circleId,
        set: { dataEnc, updatedAt: now, updatedBy: ctx.user.id },
      })
      .run();
    logActivity({ circleId: ctx.circle.id, cipher: ctx.cipher }, ctx.user.id, "profile.updated");
    redirect(`/c/${ctx.circle.id}/profile?saved=1`);
  });
}
