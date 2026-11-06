import { asc, eq } from "drizzle-orm";
import { getCircleContext } from "@/lib/auth/dal";
import { logActivity } from "@/lib/activity";
import { getDb } from "@/lib/db";
import { appointments, doseLogs, shifts } from "@/lib/db/schema";
import { appVersion } from "@/lib/env";
import { getProfile, listJournal, listMedications, listTasks } from "@/lib/data";
import type { AppointmentDetails } from "@/lib/domain";

/** Full, decrypted export of a circle for organizers. */
export async function GET(_req: Request, ctx: RouteContext<"/c/[circleId]/export">) {
  const { circleId } = await ctx.params;
  const c = await getCircleContext(circleId);
  if (!c) return new Response("Not found", { status: 404 });
  if (!c.canAdmin) return new Response("Only organizers can export data", { status: 403 });
  const db = getDb();
  const name = (id: string | null) => (id ? (c.memberById.get(id)?.name ?? "Former member") : null);
  const meds = listMedications(c, { includeInactive: true });
  const medName = new Map(meds.map((m) => [m.id, m.name]));

  const data = {
    exportedAt: new Date().toISOString(),
    kinshiftVersion: appVersion.version,
    circle: {
      name: c.circle.name,
      recipientName: c.circle.recipientName,
      timezone: c.circle.timezone,
      coverage: { start: c.circle.coverageStart, end: c.circle.coverageEnd },
      createdAt: c.circle.createdAt,
    },
    members: c.members.map((m) => ({
      name: m.name,
      email: m.email,
      role: m.role,
      relationship: m.relationship,
      joinedAt: m.joinedAt,
    })),
    profile: getProfile(c).data,
    medications: meds.map(({ circleId: _c, createdBy, ...m }) => ({
      ...m,
      createdBy: name(createdBy),
    })),
    doseLog: db
      .select()
      .from(doseLogs)
      .where(eq(doseLogs.circleId, circleId))
      .orderBy(asc(doseLogs.takenAt))
      .all()
      .map((l) => ({
        medication: medName.get(l.medicationId),
        scheduledFor: l.scheduledFor,
        status: l.status,
        recordedAt: l.takenAt,
        recordedBy: name(l.recordedBy),
        note: c.cipher.decOpt("dose.note", l.noteEnc),
      })),
    shifts: db
      .select()
      .from(shifts)
      .where(eq(shifts.circleId, circleId))
      .orderBy(asc(shifts.startsAt))
      .all()
      .map((s) => ({
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        assignee: name(s.assigneeId),
        note: c.cipher.decOpt("shift.note", s.noteEnc),
      })),
    appointments: db
      .select()
      .from(appointments)
      .where(eq(appointments.circleId, circleId))
      .orderBy(asc(appointments.startsAt))
      .all()
      .map((a) => ({
        ...c.cipher.decJson<AppointmentDetails>("appointment.data", a.dataEnc),
        kind: a.kind,
        status: a.status,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        goingWith: name(a.assigneeId),
      })),
    journal: listJournal(c, { limit: 100_000 }).map((j) => ({
      ...j,
      author: name(j.authorId),
      authorId: undefined,
    })),
    tasks: listTasks(c, { includeDoneSince: new Date(0) }).map((t) => ({
      title: t.title,
      dueDate: t.dueDate,
      assignee: name(t.assigneeId),
      doneAt: t.doneAt,
      doneBy: name(t.doneBy),
    })),
  };

  logActivity({ circleId, cipher: c.cipher }, c.user.id, "circle.exported");
  const filename = `kinshift-${c.circle.recipientName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
