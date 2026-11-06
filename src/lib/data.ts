import "server-only";
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, ne, or } from "drizzle-orm";
import type { CircleCipher } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import {
  appointments,
  doseLogs,
  journalEntries,
  medications,
  profiles,
  shifts,
  tasks,
  type Circle,
  type DoseLog,
  type JournalKind,
  type Medication,
} from "@/lib/db/schema";
import {
  EMPTY_PROFILE,
  type AppointmentDetails,
  type AppointmentView,
  type DoseItem,
  type DoseLogView,
  type JournalView,
  type MedicationDetails,
  type MedicationView,
  type ProfileData,
  type ShiftView,
  type TaskView,
  type Vitals,
} from "@/lib/domain";
import {
  checkPrnDose,
  doseInstantsBetween,
  doseInstantsForDate,
  doseState,
  type PrnCheck,
} from "@/lib/meds";
import { DAY, dayBounds } from "@/lib/time";

export type Scope = { circle: Circle; cipher: CircleCipher };

/* ------------------------------------------------------------------ */
/* Medications                                                         */
/* ------------------------------------------------------------------ */

export function decryptMedication(scope: Scope, row: Medication): MedicationView {
  const { dataEnc, ...rest } = row;
  const details = scope.cipher.decJson<MedicationDetails>("medication.data", dataEnc);
  return { ...rest, ...details };
}

export function listMedications(scope: Scope, opts: { includeInactive?: boolean } = {}) {
  const rows = getDb()
    .select()
    .from(medications)
    .where(
      opts.includeInactive
        ? eq(medications.circleId, scope.circle.id)
        : and(eq(medications.circleId, scope.circle.id), eq(medications.active, true)),
    )
    .all();
  return rows
    .map((r) => decryptMedication(scope, r))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
}

export function getMedication(scope: Scope, id: string): MedicationView | null {
  const row = getDb()
    .select()
    .from(medications)
    .where(and(eq(medications.id, id), eq(medications.circleId, scope.circle.id)))
    .get();
  return row ? decryptMedication(scope, row) : null;
}

function decryptLog(scope: Scope, l: DoseLog): DoseLogView {
  return {
    id: l.id,
    medicationId: l.medicationId,
    scheduledFor: l.scheduledFor,
    status: l.status,
    takenAt: l.takenAt,
    recordedBy: l.recordedBy,
    note: scope.cipher.decOpt("dose.note", l.noteEnc),
  };
}

/** Every scheduled dose for a local date, joined with what was logged for it. */
export function dosesForDate(
  scope: Scope,
  date: string,
  now: Date,
  meds: MedicationView[] = listMedications(scope),
): DoseItem[] {
  const tz = scope.circle.timezone;
  const planned = meds.flatMap((med) =>
    doseInstantsForDate(med, date, tz).map((scheduledFor) => ({ med, scheduledFor })),
  );
  if (planned.length === 0) return [];
  const { start, end } = dayBounds(date, tz);
  const logs = getDb()
    .select()
    .from(doseLogs)
    .where(
      and(
        eq(doseLogs.circleId, scope.circle.id),
        isNotNull(doseLogs.scheduledFor),
        gte(doseLogs.scheduledFor, new Date(start.getTime() - DAY)),
        lt(doseLogs.scheduledFor, new Date(end.getTime() + DAY)),
      ),
    )
    .all();
  const byKey = new Map(
    logs.map((l) => [`${l.medicationId}:${l.scheduledFor!.getTime()}`, decryptLog(scope, l)]),
  );
  return planned
    .map(({ med, scheduledFor }) => {
      const log = byKey.get(`${med.id}:${scheduledFor.getTime()}`) ?? null;
      return {
        med,
        scheduledFor,
        log,
        state: doseState({
          scheduledFor,
          logStatus: log?.status ?? null,
          now,
          graceMinutes: scope.circle.missedDoseGraceMinutes,
        }),
      };
    })
    .sort(
      (a, b) =>
        a.scheduledFor.getTime() - b.scheduledFor.getTime() || a.med.name.localeCompare(b.med.name),
    );
}

export type PrnItem = {
  med: MedicationView;
  lastGiven: DoseLogView | null;
  givenInLast24h: number;
  check: PrnCheck;
};

export function prnStatus(
  scope: Scope,
  now: Date,
  meds: MedicationView[] = listMedications(scope),
): PrnItem[] {
  const prn = meds.filter((m) => m.scheduleType === "prn" && m.active);
  if (prn.length === 0) return [];
  const since = new Date(now.getTime() - DAY);
  const logs = getDb()
    .select()
    .from(doseLogs)
    .where(
      and(
        inArray(
          doseLogs.medicationId,
          prn.map((m) => m.id),
        ),
        eq(doseLogs.status, "given"),
        gte(doseLogs.takenAt, new Date(now.getTime() - 30 * DAY)),
      ),
    )
    .orderBy(desc(doseLogs.takenAt))
    .all();
  return prn.map((med) => {
    const mine = logs.filter((l) => l.medicationId === med.id);
    const last = mine[0] ? decryptLog(scope, mine[0]) : null;
    const givenInLast24h = mine.filter((l) => l.takenAt >= since).length;
    return {
      med,
      lastGiven: last,
      givenInLast24h,
      check: checkPrnDose({
        lastGivenAt: last?.takenAt ?? null,
        givenInLast24h,
        minIntervalMinutes: med.minIntervalMinutes,
        maxPerDay: med.maxPerDay,
        now,
      }),
    };
  });
}

export function medicationHistory(scope: Scope, medicationId: string, limit = 30): DoseLogView[] {
  return getDb()
    .select()
    .from(doseLogs)
    .where(and(eq(doseLogs.circleId, scope.circle.id), eq(doseLogs.medicationId, medicationId)))
    .orderBy(desc(doseLogs.takenAt))
    .limit(limit)
    .all()
    .map((l) => decryptLog(scope, l));
}

export function logsBetween(scope: Scope, from: Date, to: Date) {
  return getDb()
    .select()
    .from(doseLogs)
    .where(
      and(
        eq(doseLogs.circleId, scope.circle.id),
        isNotNull(doseLogs.scheduledFor),
        gte(doseLogs.scheduledFor, from),
        lt(doseLogs.scheduledFor, to),
      ),
    )
    .all();
}

/* ------------------------------------------------------------------ */
/* Shifts & appointments                                               */
/* ------------------------------------------------------------------ */

export function shiftsBetween(scope: Scope, from: Date, to: Date): ShiftView[] {
  return getDb()
    .select()
    .from(shifts)
    .where(
      and(eq(shifts.circleId, scope.circle.id), lt(shifts.startsAt, to), gt(shifts.endsAt, from)),
    )
    .orderBy(asc(shifts.startsAt))
    .all()
    .map(({ noteEnc, ...rest }) => ({ ...rest, note: scope.cipher.decOpt("shift.note", noteEnc) }));
}

export function getShift(scope: Scope, id: string): ShiftView | null {
  const row = getDb()
    .select()
    .from(shifts)
    .where(and(eq(shifts.id, id), eq(shifts.circleId, scope.circle.id)))
    .get();
  if (!row) return null;
  const { noteEnc, ...rest } = row;
  return { ...rest, note: scope.cipher.decOpt("shift.note", noteEnc) };
}

function decryptAppointment(scope: Scope, row: typeof appointments.$inferSelect): AppointmentView {
  const { dataEnc, ...rest } = row;
  return { ...rest, ...scope.cipher.decJson<AppointmentDetails>("appointment.data", dataEnc) };
}

export function appointmentsBetween(
  scope: Scope,
  from: Date,
  to: Date,
  opts: { includeCancelled?: boolean } = {},
): AppointmentView[] {
  return getDb()
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.circleId, scope.circle.id),
        lt(appointments.startsAt, to),
        gt(appointments.endsAt, from),
        opts.includeCancelled ? undefined : ne(appointments.status, "cancelled"),
      ),
    )
    .orderBy(asc(appointments.startsAt))
    .all()
    .map((r) => decryptAppointment(scope, r));
}

export function pastAppointments(scope: Scope, before: Date, limit = 20): AppointmentView[] {
  return getDb()
    .select()
    .from(appointments)
    .where(and(eq(appointments.circleId, scope.circle.id), lt(appointments.endsAt, before)))
    .orderBy(desc(appointments.startsAt))
    .limit(limit)
    .all()
    .map((r) => decryptAppointment(scope, r));
}

export function getAppointment(scope: Scope, id: string): AppointmentView | null {
  const row = getDb()
    .select()
    .from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.circleId, scope.circle.id)))
    .get();
  return row ? decryptAppointment(scope, row) : null;
}

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

function decryptJournal(scope: Scope, r: typeof journalEntries.$inferSelect): JournalView {
  return {
    id: r.id,
    kind: r.kind,
    authorId: r.authorId,
    body: scope.cipher.dec("journal.body", r.bodyEnc),
    mood: r.mood,
    vitals: r.vitalsEnc ? scope.cipher.decJson<Vitals>("journal.vitals", r.vitalsEnc) : null,
    createdAt: r.createdAt,
  };
}

export function listJournal(
  scope: Scope,
  opts: { kind?: JournalKind; limit?: number; before?: Date } = {},
): JournalView[] {
  return getDb()
    .select()
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.circleId, scope.circle.id),
        opts.kind ? eq(journalEntries.kind, opts.kind) : undefined,
        opts.before ? lt(journalEntries.createdAt, opts.before) : undefined,
      ),
    )
    .orderBy(desc(journalEntries.createdAt))
    .limit(opts.limit ?? 50)
    .all()
    .map((r) => decryptJournal(scope, r));
}

export function latestHandoff(scope: Scope): JournalView | null {
  return listJournal(scope, { kind: "handoff", limit: 1 })[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */

export function listTasks(scope: Scope, opts: { includeDoneSince?: Date } = {}): TaskView[] {
  const rows = getDb()
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.circleId, scope.circle.id),
        opts.includeDoneSince
          ? or(isNull(tasks.doneAt), gte(tasks.doneAt, opts.includeDoneSince))
          : isNull(tasks.doneAt),
      ),
    )
    .all();
  return rows
    .map((r) => ({
      id: r.id,
      title: scope.cipher.dec("task.title", r.titleEnc),
      dueDate: r.dueDate,
      assigneeId: r.assigneeId,
      doneAt: r.doneAt,
      doneBy: r.doneBy,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
    }))
    .sort((a, b) => {
      if (!!a.doneAt !== !!b.doneAt) return a.doneAt ? 1 : -1;
      if (a.doneAt && b.doneAt) return b.doneAt.getTime() - a.doneAt.getTime();
      if (a.dueDate !== b.dueDate) {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
}

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

export function getProfile(scope: Scope): {
  data: ProfileData;
  updatedAt: Date | null;
  updatedBy: string | null;
} {
  const row = getDb().select().from(profiles).where(eq(profiles.circleId, scope.circle.id)).get();
  if (!row) return { data: { ...EMPTY_PROFILE }, updatedAt: null, updatedBy: null };
  return {
    data: {
      ...EMPTY_PROFILE,
      ...scope.cipher.decJson<Partial<ProfileData>>("profile.data", row.dataEnc),
    },
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

/* ------------------------------------------------------------------ */
/* Adherence                                                           */
/* ------------------------------------------------------------------ */

/**
 * Share of scheduled doses that were given over the last `days` days. Doses
 * still inside their grace window are not counted against anyone.
 */
export function adherenceFor(
  scope: Scope,
  meds: MedicationView[],
  days: number,
  now: Date,
): Map<string, { expected: number; given: number; percent: number | null }> {
  const to = new Date(now.getTime() - scope.circle.missedDoseGraceMinutes * 60_000);
  const from = new Date(now.getTime() - days * DAY);
  const logs = logsBetween(scope, from, to);
  const given = new Set(
    logs
      .filter((l) => l.status === "given")
      .map((l) => `${l.medicationId}:${l.scheduledFor!.getTime()}`),
  );
  const out = new Map<string, { expected: number; given: number; percent: number | null }>();
  for (const med of meds) {
    if (med.scheduleType !== "scheduled" || to <= from) continue;
    const instants = doseInstantsBetween(med, from, to, scope.circle.timezone);
    const g = instants.filter((t) => given.has(`${med.id}:${t.getTime()}`)).length;
    out.set(med.id, {
      expected: instants.length,
      given: g,
      percent: instants.length > 0 ? Math.round((g / instants.length) * 100) : null,
    });
  }
  return out;
}
