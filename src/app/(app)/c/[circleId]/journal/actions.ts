"use server";

import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { circleAction, str } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { getDb } from "@/lib/db";
import { journalEntries } from "@/lib/db/schema";
import type { Vitals } from "@/lib/domain";
import {
  errorState,
  invalid,
  optionalInt,
  optionalNumber,
  successState,
  text,
  type FormState,
} from "@/lib/forms";
import { newId } from "@/lib/id";
import { notifyCircle } from "@/lib/notify";
import { HOUR } from "@/lib/time";

const schema = z
  .object({
    kind: z.enum(["note", "handoff", "vitals", "incident"]),
    body: text(5000, "Entry"),
    mood: optionalInt(1, 5, "Mood"),
    bpSystolic: optionalInt(50, 260, "Systolic pressure"),
    bpDiastolic: optionalInt(30, 160, "Diastolic pressure"),
    pulse: optionalInt(20, 250, "Pulse"),
    temperature: optionalNumber(25, 115, "Temperature"),
    temperatureUnit: z.enum(["F", "C"]).default("F"),
    oxygen: optionalInt(50, 100, "Oxygen"),
    glucose: optionalInt(10, 800, "Glucose"),
    weight: optionalNumber(1, 1000, "Weight"),
    weightUnit: z.enum(["lb", "kg"]).default("lb"),
  })
  .superRefine((d, ctx) => {
    const hasVitals = [
      d.bpSystolic,
      d.bpDiastolic,
      d.pulse,
      d.temperature,
      d.oxygen,
      d.glucose,
      d.weight,
    ].some((v) => v !== undefined);
    if (d.kind === "vitals" && !hasVitals) {
      ctx.addIssue({ code: "custom", path: ["pulse"], message: "Enter at least one reading." });
    }
    if (d.kind !== "vitals" && !d.body) {
      ctx.addIssue({ code: "custom", path: ["body"], message: "Write something first." });
    }
    if ((d.bpSystolic === undefined) !== (d.bpDiastolic === undefined)) {
      ctx.addIssue({
        code: "custom",
        path: ["bpSystolic"],
        message: "Enter both blood pressure numbers.",
      });
    }
  });

export async function addJournalEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "edit", (ctx) => {
    const parsed = schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error, formData);
    const d = parsed.data;
    const vitals: Vitals = {};
    if (d.bpSystolic && d.bpDiastolic)
      Object.assign(vitals, { bpSystolic: d.bpSystolic, bpDiastolic: d.bpDiastolic });
    if (d.pulse) vitals.pulse = d.pulse;
    if (d.temperature)
      Object.assign(vitals, { temperature: d.temperature, temperatureUnit: d.temperatureUnit });
    if (d.oxygen) vitals.oxygen = d.oxygen;
    if (d.glucose) vitals.glucose = d.glucose;
    if (d.weight) Object.assign(vitals, { weight: d.weight, weightUnit: d.weightUnit });
    const hasVitals = Object.keys(vitals).length > 0;

    getDb()
      .insert(journalEntries)
      .values({
        id: newId(),
        circleId: ctx.circle.id,
        authorId: ctx.user.id,
        kind: d.kind,
        bodyEnc: ctx.cipher.enc("journal.body", d.body),
        mood: d.mood ?? null,
        vitalsEnc: hasVitals ? ctx.cipher.encJson("journal.vitals", vitals) : null,
        createdAt: new Date(),
      })
      .run();
    logActivity({ circleId: ctx.circle.id, cipher: ctx.cipher }, ctx.user.id, "journal.added", {
      kind: d.kind,
    });

    if (d.kind === "handoff" || d.kind === "incident") {
      const circleId = ctx.circle.id;
      const me = ctx.user;
      const who = ctx.circle.recipientName;
      const preview = d.body.length > 120 ? `${d.body.slice(0, 117)}…` : d.body;
      after(() =>
        notifyCircle(
          circleId,
          {
            kind: "journal",
            title:
              d.kind === "incident" ? `Incident reported for ${who}` : `Handoff from ${me.name}`,
            body: preview,
            discreetTitle:
              d.kind === "incident"
                ? `Incident reported for ${who}`
                : `New handoff note from ${me.name}`,
            discreetBody: "Open Kinshift to read it.",
            url: `/c/${circleId}/journal`,
            urgent: d.kind === "incident",
          },
          { exclude: [me.id] },
        ),
      );
    }
    return successState(
      d.kind === "handoff" ? "Handoff shared with the family." : "Saved to the journal.",
    );
  });
}

export async function deleteJournalEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "edit", (ctx) => {
    const db = getDb();
    const entry = db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.id, str(formData, "entryId")),
          eq(journalEntries.circleId, ctx.circle.id),
        ),
      )
      .get();
    if (!entry) return errorState("That entry was already deleted.");
    const own = entry.authorId === ctx.user.id;
    if (!(ctx.canAdmin || (own && Date.now() - entry.createdAt.getTime() < 24 * HOUR))) {
      return errorState(
        "You can delete your own entries for 24 hours. After that, ask an organizer.",
      );
    }
    db.delete(journalEntries).where(eq(journalEntries.id, entry.id)).run();
    return successState("Entry deleted.");
  });
}
