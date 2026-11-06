"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { circleAction, str } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { getDb } from "@/lib/db";
import { circles } from "@/lib/db/schema";
import {
  errorState,
  invalid,
  requiredText,
  successState,
  timeString,
  timeZone,
  type FormState,
} from "@/lib/forms";
import { forgetDataKey } from "@/lib/keys";

const schema = z.object({
  name: requiredText(80, "Circle name"),
  recipientName: requiredText(60, "Their name"),
  timezone: timeZone,
  coverageStart: timeString,
  coverageEnd: timeString,
  missedDoseGraceMinutes: z.coerce
    .number()
    .int()
    .min(15, "Use at least 15 minutes.")
    .max(720, "Use 12 hours or less."),
});

export async function updateCircle(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "admin", (ctx) => {
    const parsed = schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error, formData);
    getDb().update(circles).set(parsed.data).where(eq(circles.id, ctx.circle.id)).run();
    logActivity({ circleId: ctx.circle.id, cipher: ctx.cipher }, ctx.user.id, "circle.updated");
    return successState("Settings saved.");
  });
}

export async function deleteCircle(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "admin", (ctx) => {
    if (str(formData, "confirmName").trim() !== ctx.circle.name) {
      return errorState(`Type “${ctx.circle.name}” exactly to confirm.`);
    }
    // Cascading foreign keys remove every row that belongs to the circle.
    getDb().delete(circles).where(eq(circles.id, ctx.circle.id)).run();
    forgetDataKey(ctx.circle.id);
    redirect("/");
  });
}
