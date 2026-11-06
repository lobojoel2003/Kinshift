import "server-only";
import { eq, lt } from "drizzle-orm";
import { onDutyAt } from "@/lib/coverage";
import {
  appointmentsBetween,
  listMedications,
  logsBetween,
  shiftsBetween,
  type Scope,
} from "@/lib/data";
import { getDb } from "@/lib/db";
import { circles, memberships, notificationLog } from "@/lib/db/schema";
import type { MedicationView } from "@/lib/domain";
import { cipherFor } from "@/lib/keys";
import { doseInstantsBetween } from "@/lib/meds";
import { claimNotification, notifyCircle } from "@/lib/notify";
import { DAY, HOUR, MINUTE, formatDate, formatTime, formatTimeRange } from "@/lib/time";

/**
 * One pass of the reminder engine. Safe to run as often as you like: every
 * reminder has a unique key in `notification_log`, so it is sent once.
 */
export async function runReminderTick(now: Date = new Date()): Promise<number> {
  const db = getDb();
  let sent = 0;
  for (const circle of db.select().from(circles).all()) {
    try {
      sent += await tickCircle({ circle, cipher: cipherFor(circle) }, now);
    } catch (err) {
      console.error(`[kinshift] Reminder tick failed for circle ${circle.id}`, err);
    }
  }
  // Forget old reminder keys so the table stays small.
  db.delete(notificationLog)
    .where(lt(notificationLog.sentAt, new Date(now.getTime() - 14 * DAY)))
    .run();
  return sent;
}

function caregivers(circleId: string): string[] {
  return getDb()
    .select({ userId: memberships.userId, role: memberships.role })
    .from(memberships)
    .where(eq(memberships.circleId, circleId))
    .all()
    .filter((m) => m.role !== "viewer")
    .map((m) => m.userId);
}

function names(meds: MedicationView[]) {
  return meds.map((m) => [m.name, m.dosage].filter(Boolean).join(" ")).join(", ");
}

async function tickCircle(scope: Scope, now: Date): Promise<number> {
  const { circle } = scope;
  const tz = circle.timezone;
  const who = circle.recipientName;
  const url = `/c/${circle.id}`;
  const t = now.getTime();
  let sent = 0;

  const meds = listMedications(scope).filter((m) => m.scheduleType === "scheduled");
  const shifts = shiftsBetween(scope, new Date(t - DAY), new Date(t + 2 * DAY));
  const graceMs = circle.missedDoseGraceMinutes * MINUTE;
  const lookback = 6 * HOUR;

  if (meds.length > 0) {
    const logs = logsBetween(scope, new Date(t - lookback - graceMs), new Date(t + 2 * MINUTE));
    const logged = new Set(logs.map((l) => `${l.medicationId}:${l.scheduledFor!.getTime()}`));

    // Doses due now, grouped by time so three pills at 8:00 make one notification.
    const due = new Map<number, MedicationView[]>();
    const missed = new Map<number, MedicationView[]>();
    for (const med of meds) {
      for (const at of doseInstantsBetween(
        med,
        new Date(t - 10 * MINUTE),
        new Date(t + MINUTE),
        tz,
      )) {
        if (logged.has(`${med.id}:${at.getTime()}`)) continue;
        if (!claimNotification(`due:${med.id}:${at.getTime()}`)) continue;
        due.set(at.getTime(), [...(due.get(at.getTime()) ?? []), med]);
      }
      for (const at of doseInstantsBetween(
        med,
        new Date(t - lookback - graceMs),
        new Date(t - graceMs),
        tz,
      )) {
        if (logged.has(`${med.id}:${at.getTime()}`)) continue;
        if (!claimNotification(`missed:${med.id}:${at.getTime()}`)) continue;
        missed.set(at.getTime(), [...(missed.get(at.getTime()) ?? []), med]);
      }
    }

    for (const [at, list] of due) {
      const time = formatTime(new Date(at), tz);
      const onDuty = onDutyAt(shifts, new Date(at)).map((s) => s.assigneeId!);
      await notifyCircle(
        circle.id,
        {
          kind: "doses",
          title: `Time for ${who}’s ${time} medication${list.length > 1 ? "s" : ""}`,
          body: `${names(list)}. Tap to mark ${list.length > 1 ? "them" : "it"} as given.`,
          discreetTitle: "Medication reminder",
          discreetBody: `${who} has ${list.length > 1 ? `${list.length} doses` : "a dose"} due at ${time}.`,
          url: `${url}#meds`,
          tag: `due-${circle.id}-${at}`,
        },
        onDuty.length > 0 ? { to: onDuty } : {},
      );
      sent++;
    }

    for (const [at, list] of missed) {
      const time = formatTime(new Date(at), tz);
      await notifyCircle(
        circle.id,
        {
          kind: "missed",
          title: `Not logged: ${who}’s ${time} dose${list.length > 1 ? "s" : ""}`,
          body: `${names(list)} ${list.length > 1 ? "haven’t" : "hasn’t"} been marked as given. If it was given, log it so nobody doubles it.`,
          discreetTitle: "A dose hasn’t been logged",
          discreetBody: `${who}’s ${time} dose isn’t marked as given yet.`,
          url: `${url}#meds`,
          tag: `missed-${circle.id}-${at}`,
          urgent: true,
        },
        { to: caregivers(circle.id) },
      );
      sent++;
    }
  }

  // Shift starting within the hour: remind the person on it.
  for (const s of shifts) {
    const until = s.startsAt.getTime() - t;
    const range = formatTimeRange(s.startsAt, s.endsAt, tz);
    if (
      s.assigneeId &&
      until > 0 &&
      until <= HOUR &&
      claimNotification(`shift-soon:${s.id}:${s.startsAt.getTime()}`)
    ) {
      await notifyCircle(
        circle.id,
        {
          kind: "shifts",
          title: "Your care shift starts soon",
          body: `You’re with ${who} ${range}. Read the latest handoff before you go.`,
          url: `${url}/journal`,
          tag: `shift-soon-${s.id}`,
        },
        { to: [s.assigneeId] },
      );
      sent++;
    }
    if (
      !s.assigneeId &&
      until > 0 &&
      until <= DAY &&
      claimNotification(`shift-open24:${s.id}:${s.startsAt.getTime()}`)
    ) {
      await notifyCircle(circle.id, {
        kind: "shifts",
        title: "Nobody has taken tomorrow’s shift",
        body: `${formatDate(s.startsAt, tz, "medium")}, ${range} is still open. Can you take it?`,
        url: `${url}/schedule`,
        tag: `shift-open-${s.id}`,
        urgent: until <= 6 * HOUR,
      });
      sent++;
    }
  }

  // Appointments: a day before, two hours before, and a nudge when nobody is going.
  const appts = appointmentsBetween(scope, now, new Date(t + 2 * DAY)).filter(
    (a) => a.status === "scheduled",
  );
  for (const a of appts) {
    const until = a.startsAt.getTime() - t;
    const when = `${formatDate(a.startsAt, tz, "medium")}, ${formatTimeRange(a.startsAt, a.endsAt, tz)}`;
    const audience = a.assigneeId ? { to: [a.assigneeId] } : {};
    const base = { kind: "appointments" as const, url: `${url}/appointments/${a.id}` };
    if (
      until > 0 &&
      until <= 2 * HOUR &&
      claimNotification(`appt-2h:${a.id}:${a.startsAt.getTime()}`)
    ) {
      claimNotification(`appt-24h:${a.id}:${a.startsAt.getTime()}`);
      await notifyCircle(
        circle.id,
        {
          ...base,
          title: `${a.title} at ${formatTime(a.startsAt, tz)}`,
          body: `${who}’s appointment${a.location ? ` at ${a.location}` : ""} starts soon.`,
          discreetTitle: "Appointment soon",
          discreetBody: `${who} has an appointment at ${formatTime(a.startsAt, tz)}.`,
          tag: `appt-${a.id}`,
        },
        audience,
      );
      sent++;
    } else if (
      until > 2 * HOUR &&
      until <= DAY &&
      claimNotification(`appt-24h:${a.id}:${a.startsAt.getTime()}`)
    ) {
      await notifyCircle(
        circle.id,
        {
          ...base,
          title: `Tomorrow: ${a.title}`,
          body: `${when}.${a.assigneeId ? "" : " Nobody is going with them yet."}`,
          discreetTitle: "Appointment tomorrow",
          discreetBody: `${who} has an appointment: ${when}.`,
          tag: `appt-${a.id}`,
        },
        audience,
      );
      sent++;
    }
    if (
      !a.assigneeId &&
      until > 0 &&
      until <= 2 * DAY &&
      claimNotification(`appt-noone:${a.id}:${a.startsAt.getTime()}`)
    ) {
      await notifyCircle(circle.id, {
        ...base,
        title: "Who’s going to the appointment?",
        body: `${a.title}, ${when}. Nobody has said they’re going with ${who}.`,
        discreetTitle: "An appointment needs someone",
        discreetBody: `Nobody is going with ${who} yet: ${when}.`,
        tag: `appt-noone-${a.id}`,
      });
      sent++;
    }
  }

  return sent;
}
