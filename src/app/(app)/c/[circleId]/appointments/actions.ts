"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { circleAction, str } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import type { CircleContext } from "@/lib/auth/dal";
import { getAppointment } from "@/lib/data";
import { getDb } from "@/lib/db";
import { appointments } from "@/lib/db/schema";
import type { AppointmentDetails } from "@/lib/domain";
import {
  dateString,
  errorState,
  invalid,
  requiredText,
  successState,
  text,
  timeString,
  type FormState,
} from "@/lib/forms";
import { newId } from "@/lib/id";
import { notifyCircle } from "@/lib/notify";
import { canEdit } from "@/lib/roles";
import { formatDate, formatTimeRange, minutesOf, zonedInstant } from "@/lib/time";

const schema = z
  .object({
    title: requiredText(100, "Title"),
    kind: z.enum(["doctor", "therapy", "lab", "dental", "vision", "other"]).default("doctor"),
    date: dateString,
    start: timeString,
    end: timeString,
    location: text(200, "Location"),
    provider: text(100, "Provider"),
    notes: text(2000, "Notes"),
    assigneeId: z.string().max(64).default(""),
    confirm: z.string().optional(),
  })
  .refine((d) => minutesOf(d.end) > minutesOf(d.start), {
    path: ["end"],
    message: "The end time must be after the start time.",
  });

function describe(ctx: CircleContext, startsAt: Date, endsAt: Date) {
  const tz = ctx.circle.timezone;
  return `${formatDate(startsAt, tz, "medium")}, ${formatTimeRange(startsAt, endsAt, tz, ctx.user.hour12)}`;
}

export async function saveAppointment(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "edit", (ctx) => {
    const parsed = schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error, formData);
    const d = parsed.data;
    const tz = ctx.circle.timezone;
    const startsAt = zonedInstant(d.date, d.start, tz);
    const endsAt = zonedInstant(d.date, d.end, tz);
    const assignee = d.assigneeId ? ctx.memberById.get(d.assigneeId) : undefined;
    if (d.assigneeId && (!assignee || !canEdit(assignee.role))) {
      return errorState("Pick a caregiver from this circle, or leave it unassigned.");
    }
    const id = str(formData, "appointmentId");
    const existing = id ? getAppointment(ctx, id) : null;
    if (id && !existing) return errorState("That appointment was removed.");

    if (d.confirm !== "1") {
      const clashes = getDb()
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.circleId, ctx.circle.id),
            ne(appointments.status, "cancelled"),
            lt(appointments.startsAt, endsAt),
            gt(appointments.endsAt, startsAt),
            id ? ne(appointments.id, id) : undefined,
          ),
        )
        .all();
      if (clashes.length > 0) {
        return {
          status: "error",
          message: "This clashes with another appointment.",
          confirm: {
            title: `This overlaps ${clashes.length === 1 ? "another appointment" : `${clashes.length} appointments`}`,
            details: clashes.map((c) => {
              const det = ctx.cipher.decJson<AppointmentDetails>("appointment.data", c.dataEnc);
              return `${det.title}: ${describe(ctx, c.startsAt, c.endsAt)}`;
            }),
          },
          values: Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)])),
          at: Date.now(),
        };
      }
    }

    const details: AppointmentDetails = {
      title: d.title,
      location: d.location,
      provider: d.provider,
      notes: d.notes,
    };
    const values = {
      dataEnc: ctx.cipher.encJson("appointment.data", details),
      kind: d.kind,
      startsAt,
      endsAt,
      assigneeId: assignee?.userId ?? null,
    };
    const db = getDb();
    let apptId = id;
    if (existing) {
      db.update(appointments)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(appointments.id, existing.id))
        .run();
      logActivity(
        { circleId: ctx.circle.id, cipher: ctx.cipher },
        ctx.user.id,
        "appointment.updated",
        { title: d.title },
      );
    } else {
      apptId = newId();
      db.insert(appointments)
        .values({
          id: apptId,
          circleId: ctx.circle.id,
          ...values,
          createdBy: ctx.user.id,
          createdAt: new Date(),
        })
        .run();
      logActivity(
        { circleId: ctx.circle.id, cipher: ctx.cipher },
        ctx.user.id,
        "appointment.added",
        { title: d.title },
      );
    }

    const circleId = ctx.circle.id;
    const me = ctx.user;
    const when = describe(ctx, startsAt, endsAt);
    const who = ctx.circle.recipientName;
    if (assignee && assignee.userId !== me.id && assignee.userId !== existing?.assigneeId) {
      after(() =>
        notifyCircle(
          circleId,
          {
            kind: "appointments",
            title: `You’re taking ${who} to “${d.title}”`,
            body: `${me.name} asked you to go along: ${when}.`,
            discreetTitle: "You’ve been asked to an appointment",
            discreetBody: `${me.name} asked you to go with ${who}: ${when}.`,
            url: `/c/${circleId}/appointments/${apptId}`,
          },
          { to: [assignee.userId] },
        ),
      );
    } else if (!existing) {
      after(() =>
        notifyCircle(
          circleId,
          {
            kind: "appointments",
            title: `New appointment: ${d.title}`,
            body: `${when}.${assignee ? "" : " Nobody is going with them yet."}`,
            discreetTitle: "New appointment added",
            discreetBody: `${me.name} added an appointment for ${who}: ${when}.`,
            url: `/c/${circleId}/appointments/${apptId}`,
          },
          { exclude: [me.id] },
        ),
      );
    }
    redirect(`/c/${circleId}/appointments/${apptId}?saved=1`);
  });
}

export async function setAppointmentStatus(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return circleAction(formData, "edit", (ctx) => {
    const appt = getAppointment(ctx, str(formData, "appointmentId"));
    if (!appt) return errorState("That appointment was removed.");
    const status = z.enum(["scheduled", "done", "cancelled"]).safeParse(str(formData, "status"));
    if (!status.success) return errorState("Unknown status.");
    getDb()
      .update(appointments)
      .set({ status: status.data, updatedAt: new Date() })
      .where(eq(appointments.id, appt.id))
      .run();
    if (status.data !== "scheduled") {
      logActivity(
        { circleId: ctx.circle.id, cipher: ctx.cipher },
        ctx.user.id,
        `appointment.${status.data}`,
        { title: appt.title },
      );
    }
    if (status.data === "cancelled" && appt.startsAt.getTime() > Date.now()) {
      const circleId = ctx.circle.id;
      const me = ctx.user;
      const when = describe(ctx, appt.startsAt, appt.endsAt);
      after(() =>
        notifyCircle(
          circleId,
          {
            kind: "appointments",
            title: `Cancelled: ${appt.title}`,
            body: `${me.name} cancelled the appointment on ${when}.`,
            discreetTitle: "An appointment was cancelled",
            discreetBody: `${me.name} cancelled the appointment on ${when}.`,
            url: `/c/${circleId}/appointments/${appt.id}`,
          },
          { exclude: [me.id] },
        ),
      );
    }
    return successState(
      status.data === "done"
        ? "Marked as done. Add any notes from the visit to the journal."
        : status.data === "cancelled"
          ? "Appointment cancelled."
          : "Appointment restored.",
    );
  });
}

export async function takeAppointment(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "edit", (ctx) => {
    const appt = getAppointment(ctx, str(formData, "appointmentId"));
    if (!appt) return errorState("That appointment was removed.");
    if (appt.assigneeId && appt.assigneeId !== ctx.user.id) {
      return errorState(
        `${ctx.memberById.get(appt.assigneeId)?.name ?? "Someone"} is already going.`,
      );
    }
    const res = getDb()
      .update(appointments)
      .set({ assigneeId: ctx.user.id, updatedAt: new Date() })
      .where(and(eq(appointments.id, appt.id), eq(appointments.circleId, ctx.circle.id)))
      .run();
    if (res.changes === 0) return errorState("Could not update the appointment.");
    logActivity(
      { circleId: ctx.circle.id, cipher: ctx.cipher },
      ctx.user.id,
      "appointment.assigned",
      { title: appt.title },
    );
    return successState(`Thanks! You’re going to “${appt.title}”.`);
  });
}

export async function deleteAppointment(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "edit", (ctx) => {
    const appt = getAppointment(ctx, str(formData, "appointmentId"));
    if (!appt) return errorState("That appointment was already removed.");
    if (!ctx.canAdmin && appt.createdBy !== ctx.user.id) {
      return errorState(
        "Only an organizer or the person who added it can delete this. You can cancel it instead.",
      );
    }
    getDb().delete(appointments).where(eq(appointments.id, appt.id)).run();
    logActivity(
      { circleId: ctx.circle.id, cipher: ctx.cipher },
      ctx.user.id,
      "appointment.deleted",
      { title: appt.title },
    );
    redirect(`/c/${ctx.circle.id}/appointments`);
  });
}
