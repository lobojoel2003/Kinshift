import "server-only";
import { desc, eq } from "drizzle-orm";
import type { CircleCipher } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { activity } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { formatDateTime, formatTime, formatTimeRange } from "@/lib/time";

export type ActivityData = Record<string, string | number | boolean | null | undefined>;

export function logActivity(
  target: { circleId: string; cipher: CircleCipher },
  actorId: string | null,
  type: string,
  data: ActivityData = {},
) {
  getDb()
    .insert(activity)
    .values({
      id: newId(),
      circleId: target.circleId,
      actorId,
      type,
      dataEnc: target.cipher.encJson("activity.data", data),
      createdAt: new Date(),
    })
    .run();
}

export type ActivityView = {
  id: string;
  type: string;
  actorId: string | null;
  text: string;
  createdAt: Date;
};

export function recentActivity(
  target: { circleId: string; cipher: CircleCipher },
  tz: string,
  hour12: boolean,
  limit = 10,
): ActivityView[] {
  const rows = getDb()
    .select()
    .from(activity)
    .where(eq(activity.circleId, target.circleId))
    .orderBy(desc(activity.createdAt))
    .limit(limit)
    .all();
  return rows.map((r) => {
    let data: ActivityData = {};
    try {
      data = target.cipher.decJson<ActivityData>("activity.data", r.dataEnc);
    } catch {
      data = {};
    }
    return {
      id: r.id,
      type: r.type,
      actorId: r.actorId,
      text: describeActivity(r.type, data, tz, hour12),
      createdAt: r.createdAt,
    };
  });
}

function when(value: unknown, tz: string, hour12: boolean) {
  return typeof value === "string" || typeof value === "number"
    ? formatTime(new Date(value), tz, hour12)
    : "";
}

/** Human sentence for an activity entry, without the actor's name. */
export function describeActivity(
  type: string,
  d: ActivityData,
  tz: string,
  hour12: boolean,
): string {
  const med = d.med ? String(d.med) : "a medication";
  switch (type) {
    case "circle.created":
      return `started this care circle`;
    case "dose.given":
      return d.scheduledFor
        ? `gave ${med} (${when(d.scheduledFor, tz, hour12)} dose)${d.late ? ", late" : ""}`
        : `gave a dose of ${med}${d.override ? " (overrode the safety limit)" : ""}`;
    case "dose.skipped":
      return `marked the ${when(d.scheduledFor, tz, hour12)} dose of ${med} as skipped`;
    case "dose.undone":
      return `undid a logged dose of ${med}`;
    case "med.added":
      return `added ${med} to the medication list`;
    case "med.updated":
      return `updated ${med}`;
    case "med.stopped":
      return `stopped ${med}`;
    case "med.resumed":
      return `restarted ${med}`;
    case "med.deleted":
      return `removed ${med}`;
    case "med.restocked":
      return `updated the supply of ${med} to ${d.count}`;
    case "shift.added":
      return d.count && Number(d.count) > 1
        ? `added ${d.count} weekly shifts starting ${d.start ? formatDateTime(new Date(String(d.start)), tz, hour12) : ""}`
        : `added a shift on ${d.start ? formatDateTime(new Date(String(d.start)), tz, hour12) : "the schedule"}`;
    case "shift.claimed":
      return `took the shift on ${d.start ? formatDateTime(new Date(String(d.start)), tz, hour12) : "the schedule"}`;
    case "shift.released":
      return `gave up the shift on ${d.start ? formatDateTime(new Date(String(d.start)), tz, hour12) : "the schedule"}`;
    case "shift.updated":
      return `changed the shift on ${d.start ? formatDateTime(new Date(String(d.start)), tz, hour12) : "the schedule"}`;
    case "shift.removed":
      return `removed ${d.count && Number(d.count) > 1 ? `${d.count} shifts` : "a shift"}`;
    case "shift.covered":
      return `covered a gap ${d.start && d.end ? formatTimeRange(new Date(String(d.start)), new Date(String(d.end)), tz, hour12) : ""}`;
    case "appointment.added":
      return `added the appointment “${d.title ?? "Appointment"}”`;
    case "appointment.updated":
      return `updated the appointment “${d.title ?? "Appointment"}”`;
    case "appointment.cancelled":
      return `cancelled “${d.title ?? "an appointment"}”`;
    case "appointment.done":
      return `marked “${d.title ?? "an appointment"}” as done`;
    case "appointment.deleted":
      return `deleted the appointment “${d.title ?? "Appointment"}”`;
    case "appointment.assigned":
      return `is taking ${d.title ? `“${d.title}”` : "an appointment"}`;
    case "journal.added":
      return d.kind === "handoff"
        ? "wrote a handoff note"
        : d.kind === "vitals"
          ? "logged vitals"
          : d.kind === "incident"
            ? "reported an incident"
            : "added a journal note";
    case "task.added":
      return `added the task “${d.title ?? "Task"}”`;
    case "task.done":
      return `finished “${d.title ?? "a task"}”`;
    case "task.reopened":
      return `reopened “${d.title ?? "a task"}”`;
    case "member.joined":
      return `joined the circle`;
    case "member.left":
      return `left the circle`;
    case "member.removed":
      return `removed ${d.name ?? "a member"} from the circle`;
    case "member.role":
      return `made ${d.name ?? "a member"} ${d.role === "owner" ? "an organizer" : `a ${d.role}`}`;
    case "invite.created":
      return `created an invite link`;
    case "profile.updated":
      return `updated the care profile`;
    case "circle.updated":
      return `changed the circle settings`;
    case "circle.exported":
      return `downloaded an export of the circle’s data`;
    default:
      return "made a change";
  }
}
