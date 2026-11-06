"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { circleAction, isUniqueViolation, str } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import type { CircleContext } from "@/lib/auth/dal";
import { isColorName } from "@/lib/colors";
import { decryptMedication, getMedication, prnStatus } from "@/lib/data";
import { getDb } from "@/lib/db";
import { doseLogs, medications } from "@/lib/db/schema";
import type { MedicationDetails } from "@/lib/domain";
import {
  dateString,
  errorState,
  invalid,
  optionalDate,
  optionalInt,
  requiredText,
  successState,
  text,
  type FormState,
} from "@/lib/forms";
import { newId } from "@/lib/id";
import { doseInstantsForDate, sortTimes, stockStatus, dosesPerDay } from "@/lib/meds";
import { notifyCircle } from "@/lib/notify";
import { HOUR, formatTime, isTimeString, localDateOf, todayIn } from "@/lib/time";

const medSchema = z
  .object({
    name: requiredText(80, "Medication name"),
    dosage: text(60, "Dosage"),
    instructions: text(500, "Instructions"),
    purpose: text(120, "Purpose"),
    prescriber: text(80, "Prescriber"),
    scheduleType: z.enum(["scheduled", "prn"]),
    times: z.array(z.string()).default([]),
    days: z.array(z.coerce.number().int().min(0).max(6)).default([]),
    startDate: dateString,
    endDate: optionalDate,
    minIntervalHours: z.preprocess(
      (v) => (v === "" || v === undefined ? undefined : v),
      z.coerce
        .number()
        .min(0.25, "Use at least 15 minutes.")
        .max(72, "Use 72 hours or less.")
        .optional(),
    ),
    maxPerDay: optionalInt(1, 24, "Daily maximum"),
    doseQuantity: optionalInt(1, 20, "Units per dose"),
    stockCount: optionalInt(0, 5000, "Supply"),
    stockAlertAt: optionalInt(0, 1000, "Refill alert"),
    color: z.string().refine(isColorName).default("teal"),
  })
  .superRefine((d, ctx) => {
    if (d.scheduleType === "scheduled") {
      const valid = d.times.filter((t) => t.trim() !== "");
      if (valid.length === 0)
        ctx.addIssue({ code: "custom", path: ["times"], message: "Add at least one time." });
      if (valid.some((t) => !isTimeString(t))) {
        ctx.addIssue({
          code: "custom",
          path: ["times"],
          message: "One of the times is not valid.",
        });
      }
      if (valid.length > 12)
        ctx.addIssue({ code: "custom", path: ["times"], message: "Use 12 times or fewer." });
    }
    if (d.endDate && d.endDate < d.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "The end date is before the start date.",
      });
    }
  });

function parseMedForm(formData: FormData) {
  return medSchema.safeParse({
    ...Object.fromEntries(formData),
    times: formData.getAll("times").map(String),
    days: formData.getAll("days").map(String),
  });
}

export async function saveMedication(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "edit", (ctx) => {
    const parsed = parseMedForm(formData);
    if (!parsed.success) return invalid(parsed.error, formData);
    const d = parsed.data;
    const id = str(formData, "medicationId");
    const details: MedicationDetails = {
      name: d.name,
      dosage: d.dosage,
      instructions: d.instructions,
      purpose: d.purpose,
      prescriber: d.prescriber,
    };
    const scheduled = d.scheduleType === "scheduled";
    const days = [...new Set(d.days)].sort();
    const values = {
      dataEnc: ctx.cipher.encJson("medication.data", details),
      scheduleType: d.scheduleType,
      times: scheduled ? sortTimes(d.times.filter(Boolean)) : [],
      daysOfWeek: scheduled && days.length > 0 && days.length < 7 ? days : null,
      startDate: d.startDate,
      endDate: d.endDate ?? null,
      minIntervalMinutes:
        !scheduled && d.minIntervalHours ? Math.round(d.minIntervalHours * 60) : null,
      maxPerDay: !scheduled ? (d.maxPerDay ?? null) : null,
      doseQuantity: d.doseQuantity ?? 1,
      stockCount: d.stockCount ?? null,
      stockAlertAt: d.stockAlertAt ?? null,
      color: d.color,
    };
    const db = getDb();
    if (id) {
      const existing = getMedication(ctx, id);
      if (!existing) return errorState("That medication no longer exists.");
      db.update(medications)
        .set({ ...values, updatedAt: new Date() })
        .where(and(eq(medications.id, id), eq(medications.circleId, ctx.circle.id)))
        .run();
      logActivity({ circleId: ctx.circle.id, cipher: ctx.cipher }, ctx.user.id, "med.updated", {
        med: d.name,
      });
      redirect(`/c/${ctx.circle.id}/meds/${id}?saved=1`);
    }
    const newMedId = newId();
    db.insert(medications)
      .values({
        id: newMedId,
        circleId: ctx.circle.id,
        ...values,
        createdBy: ctx.user.id,
        createdAt: new Date(),
      })
      .run();
    logActivity({ circleId: ctx.circle.id, cipher: ctx.cipher }, ctx.user.id, "med.added", {
      med: d.name,
    });
    redirect(`/c/${ctx.circle.id}/meds?added=${newMedId}`);
  });
}

function loadMed(ctx: CircleContext, id: string) {
  const row = getDb()
    .select()
    .from(medications)
    .where(and(eq(medications.id, id), eq(medications.circleId, ctx.circle.id)))
    .get();
  return row ? decryptMedication(ctx, row) : null;
}

function adjustStock(ctx: CircleContext, medId: string, delta: number) {
  getDb()
    .update(medications)
    .set({ stockCount: sql`max(0, ${medications.stockCount} + ${delta})` })
    .where(
      and(
        eq(medications.id, medId),
        eq(medications.circleId, ctx.circle.id),
        sql`${medications.stockCount} is not null`,
      ),
    )
    .run();
}

function warnIfLowStock(ctx: CircleContext, medId: string) {
  const med = loadMed(ctx, medId);
  if (!med || med.stockCount === null) return;
  const { level, daysLeft } = stockStatus({
    stockCount: med.stockCount,
    stockAlertAt: med.stockAlertAt,
    doseQuantity: med.doseQuantity,
    perDay: dosesPerDay(med),
  });
  if (level !== "low" && level !== "out") return;
  const circleId = ctx.circle.id;
  const who = ctx.circle.recipientName;
  after(() =>
    notifyCircle(circleId, {
      kind: "doses",
      title: level === "out" ? `${med.name} has run out` : `${med.name} is running low`,
      body:
        level === "out"
          ? `No ${med.name} left for ${who}. Time to refill.`
          : `${med.stockCount} left${daysLeft !== null ? `, about ${daysLeft} days` : ""}. Time to refill for ${who}.`,
      discreetTitle: "A refill is needed",
      discreetBody: `One of ${who}’s medications is running low.`,
      url: `/c/${circleId}/meds/${med.id}`,
      tag: `stock-${med.id}`,
    }),
  );
}

/** Mark a scheduled dose as given or skipped. The database refuses duplicates. */
export async function logDose(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "edit", (ctx) => {
    const med = loadMed(ctx, str(formData, "medicationId"));
    if (!med) return errorState("That medication no longer exists.");
    const status = str(formData, "status") === "skipped" ? "skipped" : "given";
    const scheduledFor = new Date(Number(str(formData, "scheduledFor")));
    if (Number.isNaN(scheduledFor.getTime())) return errorState("That dose time is not valid.");
    const tz = ctx.circle.timezone;
    const valid = doseInstantsForDate(med, localDateOf(scheduledFor, tz), tz).some(
      (t) => t.getTime() === scheduledFor.getTime(),
    );
    if (!valid)
      return errorState("That dose is not on the schedule any more. Refresh to see changes.");
    const now = new Date();
    if (status === "given" && scheduledFor.getTime() - now.getTime() > 2 * HOUR) {
      return errorState(
        `It’s too early to give the ${formatTime(scheduledFor, tz, ctx.user.hour12)} dose.`,
      );
    }
    const note = text(300, "Note").safeParse(str(formData, "note"));
    try {
      getDb()
        .insert(doseLogs)
        .values({
          id: newId(),
          circleId: ctx.circle.id,
          medicationId: med.id,
          scheduledFor,
          status,
          takenAt: now,
          recordedBy: ctx.user.id,
          noteEnc: ctx.cipher.encOpt("dose.note", note.success ? note.data : null),
          createdAt: now,
        })
        .run();
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const existing = getDb()
        .select()
        .from(doseLogs)
        .where(and(eq(doseLogs.medicationId, med.id), eq(doseLogs.scheduledFor, scheduledFor)))
        .get();
      const by = existing?.recordedBy ? ctx.memberById.get(existing.recordedBy)?.name : null;
      const when = existing ? formatTime(existing.takenAt, tz, ctx.user.hour12) : "";
      return errorState(
        existing?.status === "skipped"
          ? `${by ?? "Someone"} already marked this dose as skipped at ${when}.`
          : `Already given by ${by ?? "someone"} at ${when}. No need to give it again.`,
      );
    }
    if (status === "given") {
      adjustStock(ctx, med.id, -med.doseQuantity);
      warnIfLowStock(ctx, med.id);
    }
    const late =
      now.getTime() - scheduledFor.getTime() > ctx.circle.missedDoseGraceMinutes * 60_000;
    logActivity(
      { circleId: ctx.circle.id, cipher: ctx.cipher },
      ctx.user.id,
      status === "given" ? "dose.given" : "dose.skipped",
      {
        med: med.name,
        scheduledFor: scheduledFor.toISOString(),
        late,
      },
    );
    return successState(
      status === "given"
        ? `${med.name} marked as given.`
        : `${med.name} (${formatTime(scheduledFor, tz, ctx.user.hour12)}) marked as skipped.`,
    );
  });
}

/** Undo a dose log, for when someone tapped the wrong medication. */
export async function undoDose(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "edit", (ctx) => {
    const db = getDb();
    const log = db
      .select()
      .from(doseLogs)
      .where(and(eq(doseLogs.id, str(formData, "logId")), eq(doseLogs.circleId, ctx.circle.id)))
      .get();
    if (!log) return errorState("That entry was already removed.");
    if (log.recordedBy !== ctx.user.id && !ctx.canAdmin) {
      return errorState("Only the person who logged this dose, or an organizer, can undo it.");
    }
    if (Date.now() - log.createdAt.getTime() > 24 * HOUR) {
      return errorState("Doses can only be undone within 24 hours.");
    }
    db.delete(doseLogs).where(eq(doseLogs.id, log.id)).run();
    const med = loadMed(ctx, log.medicationId);
    if (log.status === "given" && med) adjustStock(ctx, med.id, med.doseQuantity);
    logActivity({ circleId: ctx.circle.id, cipher: ctx.cipher }, ctx.user.id, "dose.undone", {
      med: med?.name,
    });
    return successState("Dose entry removed.");
  });
}

/** Give an as-needed dose, respecting minimum spacing and daily maximum unless overridden. */
export async function givePrnDose(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "edit", (ctx) => {
    const now = new Date();
    const medId = str(formData, "medicationId");
    const status = prnStatus(ctx, now).find((p) => p.med.id === medId);
    if (!status) return errorState("That medication is not available as needed.");
    const tz = ctx.circle.timezone;
    const override = str(formData, "override") === "1";
    if (!status.check.allowed && !override) {
      const details =
        status.check.reason === "interval"
          ? [
              `The last dose was at ${formatTime(status.check.lastGivenAt, tz, ctx.user.hour12)}${
                status.lastGiven?.recordedBy
                  ? `, given by ${ctx.memberById.get(status.lastGiven.recordedBy)?.name ?? "someone"}`
                  : ""
              }.`,
              `The next dose is allowed from ${formatTime(status.check.nextAllowedAt, tz, ctx.user.hour12)}.`,
            ]
          : [
              `${status.check.maxPerDay} doses have already been given in the last 24 hours, the daily maximum.`,
            ];
      return {
        status: "error",
        message: "This dose is outside the safety limits.",
        confirm: { title: `Give ${status.med.name} anyway?`, details },
        at: Date.now(),
      };
    }
    const reason = text(300, "Reason").safeParse(str(formData, "note"));
    getDb()
      .insert(doseLogs)
      .values({
        id: newId(),
        circleId: ctx.circle.id,
        medicationId: medId,
        scheduledFor: null,
        status: "given",
        takenAt: now,
        recordedBy: ctx.user.id,
        noteEnc: ctx.cipher.encOpt("dose.note", reason.success ? reason.data : null),
        createdAt: now,
      })
      .run();
    adjustStock(ctx, medId, -status.med.doseQuantity);
    warnIfLowStock(ctx, medId);
    logActivity({ circleId: ctx.circle.id, cipher: ctx.cipher }, ctx.user.id, "dose.given", {
      med: status.med.name,
      override: !status.check.allowed,
    });
    if (!status.check.allowed) {
      const circleId = ctx.circle.id;
      const who = ctx.user.name;
      const medName = status.med.name;
      after(() =>
        notifyCircle(
          circleId,
          {
            kind: "missed",
            title: `Extra dose of ${medName}`,
            body: `${who} gave ${medName} outside its safety limits.`,
            discreetTitle: "A dose outside the usual limits",
            discreetBody: `${who} logged a dose outside its safety limits.`,
            url: `/c/${circleId}/meds`,
            urgent: true,
          },
          { exclude: [ctx.user.id] },
        ),
      );
    }
    return successState(`${status.med.name} given at ${formatTime(now, tz, ctx.user.hour12)}.`);
  });
}

export async function setMedicationActive(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return circleAction(formData, "edit", (ctx) => {
    const med = loadMed(ctx, str(formData, "medicationId"));
    if (!med) return errorState("That medication no longer exists.");
    const active = str(formData, "active") === "1";
    getDb()
      .update(medications)
      .set({
        active,
        // Restarting a course that had already ended clears its old end date.
        endDate:
          active && med.endDate && med.endDate < todayIn(ctx.circle.timezone) ? null : med.endDate,
        updatedAt: new Date(),
      })
      .where(eq(medications.id, med.id))
      .run();
    logActivity(
      { circleId: ctx.circle.id, cipher: ctx.cipher },
      ctx.user.id,
      active ? "med.resumed" : "med.stopped",
      {
        med: med.name,
      },
    );
    return successState(
      active ? `${med.name} restarted.` : `${med.name} stopped. Its history is kept.`,
    );
  });
}

export async function deleteMedication(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "admin", (ctx) => {
    const med = loadMed(ctx, str(formData, "medicationId"));
    if (!med) return errorState("That medication no longer exists.");
    getDb().delete(medications).where(eq(medications.id, med.id)).run();
    logActivity({ circleId: ctx.circle.id, cipher: ctx.cipher }, ctx.user.id, "med.deleted", {
      med: med.name,
    });
    redirect(`/c/${ctx.circle.id}/meds`);
  });
}

export async function restockMedication(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "edit", (ctx) => {
    const med = loadMed(ctx, str(formData, "medicationId"));
    if (!med) return errorState("That medication no longer exists.");
    const parsed = z.coerce.number().int().min(0).max(5000).safeParse(str(formData, "count"));
    if (!parsed.success) return errorState("Enter how many are on hand now (0 to 5000).");
    const mode = str(formData, "mode");
    const count = mode === "add" ? (med.stockCount ?? 0) + parsed.data : parsed.data;
    getDb()
      .update(medications)
      .set({ stockCount: count, updatedAt: new Date() })
      .where(eq(medications.id, med.id))
      .run();
    logActivity({ circleId: ctx.circle.id, cipher: ctx.cipher }, ctx.user.id, "med.restocked", {
      med: med.name,
      count,
    });
    return successState(`Supply of ${med.name} set to ${count}.`);
  });
}
