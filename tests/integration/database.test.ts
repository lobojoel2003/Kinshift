import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, like } from "drizzle-orm";

// Each test file gets its own throwaway data directory and secret.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "kinshift-test-"));
process.env.DATA_DIR = dataDir;
process.env.KINSHIFT_SECRET = "integration-test-secret-integration-test-secret";
process.env.KINSHIFT_DISABLE_PUSH = "1";

const { getDb, getSqlite } = await import("@/lib/db");
const schema = await import("@/lib/db/schema");
const { createCircle } = await import("@/lib/circles");
const { cipherFor, forgetDataKey } = await import("@/lib/keys");
const { isUniqueViolation } = await import("@/lib/actions");
const { dosesForDate, listMedications, prnStatus, getProfile } = await import("@/lib/data");
const { createInvite, findValidInvite, acceptInvite } = await import("@/lib/invites");
const { runReminderTick } = await import("@/lib/scheduler");
const { newId } = await import("@/lib/id");
const { zonedInstant, MINUTE, HOUR } = await import("@/lib/time");

const tz = "America/Chicago";
const db = getDb();
let ownerId = "";
let siblingId = "";
let circleId = "";
let medId = "";
let prnId = "";

function addUser(name: string, email: string) {
  const id = newId();
  db.insert(schema.users)
    .values({ id, name, email, passwordHash: "scrypt$x", createdAt: new Date() })
    .run();
  return id;
}

function circleRow() {
  return db.select().from(schema.circles).where(eq(schema.circles.id, circleId)).get()!;
}

beforeAll(() => {
  ownerId = addUser("Maya", "maya@test.local");
  siblingId = addUser("Daniel", "daniel@test.local");
  circleId = createCircle({ userId: ownerId, recipientName: "Mom", timezone: tz });
  const cipher = cipherFor(circleRow());
  medId = newId();
  prnId = newId();
  db.insert(schema.medications)
    .values([
      {
        id: medId,
        circleId,
        dataEnc: cipher.encJson("medication.data", {
          name: "Metformin",
          dosage: "500 mg",
          instructions: "",
          purpose: "",
          prescriber: "",
        }),
        scheduleType: "scheduled",
        times: ["08:00", "20:00"],
        startDate: "2026-01-01",
        stockCount: 10,
        createdAt: new Date(),
      },
      {
        id: prnId,
        circleId,
        dataEnc: cipher.encJson("medication.data", {
          name: "Acetaminophen",
          dosage: "500 mg",
          instructions: "",
          purpose: "",
          prescriber: "",
        }),
        scheduleType: "prn",
        startDate: "2026-01-01",
        minIntervalMinutes: 360,
        maxPerDay: 4,
        createdAt: new Date(),
      },
    ])
    .run();
});

afterAll(() => {
  getSqlite().close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("database", () => {
  it("runs migrations and creates the circle with its organizer", () => {
    const members = db
      .select()
      .from(schema.memberships)
      .where(eq(schema.memberships.circleId, circleId))
      .all();
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ userId: ownerId, role: "owner" });
    expect(circleRow().dataKey.startsWith("k1.")).toBe(true);
  });

  it("stores health details encrypted at rest", () => {
    getSqlite().pragma("wal_checkpoint(TRUNCATE)");
    const raw = fs.readFileSync(path.join(dataDir, "kinshift.db"));
    expect(raw.includes(Buffer.from("Metformin"))).toBe(false);
    expect(raw.includes(Buffer.from("Acetaminophen"))).toBe(false);
    expect(
      listMedications({ circle: circleRow(), cipher: cipherFor(circleRow()) }).map((m) => m.name),
    ).toEqual(["Acetaminophen", "Metformin"]);
  });

  it("refuses to record the same scheduled dose twice", () => {
    const scheduledFor = zonedInstant("2026-11-03", "08:00", tz);
    const log = (by: string) =>
      db
        .insert(schema.doseLogs)
        .values({
          id: newId(),
          circleId,
          medicationId: medId,
          scheduledFor,
          status: "given",
          takenAt: new Date(),
          recordedBy: by,
          createdAt: new Date(),
        })
        .run();
    log(ownerId);
    let error: unknown;
    try {
      log(siblingId);
    } catch (err) {
      error = err;
    }
    expect(isUniqueViolation(error)).toBe(true);
    const rows = db
      .select()
      .from(schema.doseLogs)
      .where(eq(schema.doseLogs.medicationId, medId))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0].recordedBy).toBe(ownerId);
  });

  it("allows repeated as-needed doses and reports the safety limit", () => {
    const now = new Date("2026-11-03T18:00:00Z");
    for (const hoursAgo of [8, 1]) {
      db.insert(schema.doseLogs)
        .values({
          id: newId(),
          circleId,
          medicationId: prnId,
          scheduledFor: null,
          status: "given",
          takenAt: new Date(now.getTime() - hoursAgo * HOUR),
          recordedBy: siblingId,
          createdAt: new Date(),
        })
        .run();
    }
    const [status] = prnStatus({ circle: circleRow(), cipher: cipherFor(circleRow()) }, now);
    expect(status.givenInLast24h).toBe(2);
    expect(status.check.allowed).toBe(false);
  });

  it("joins the dose schedule with what was logged", () => {
    const scope = { circle: circleRow(), cipher: cipherFor(circleRow()) };
    const doses = dosesForDate(scope, "2026-11-03", zonedInstant("2026-11-03", "12:00", tz));
    expect(doses.map((d) => d.state)).toEqual(["given", "upcoming"]);
    expect(doses[0].log?.recordedBy).toBe(ownerId);
  });

  it("returns an empty profile before one is saved", () => {
    const profile = getProfile({ circle: circleRow(), cipher: cipherFor(circleRow()) });
    expect(profile.updatedAt).toBeNull();
    expect(profile.data.emergencyContacts).toEqual([]);
  });
});

describe("invites", () => {
  it("lets family join with a link, once per person", () => {
    const token = createInvite({ circleId, role: "caregiver", createdBy: ownerId });
    expect(findValidInvite(token)).toMatchObject({
      circleId,
      role: "caregiver",
      inviterName: "Maya",
    });
    expect(acceptInvite(token, siblingId)).toBe(circleId);
    expect(acceptInvite(token, siblingId)).toBe(circleId);
    const invite = db
      .select()
      .from(schema.invites)
      .where(eq(schema.invites.circleId, circleId))
      .get()!;
    expect(invite.uses).toBe(1);
    expect(invite.tokenHash).not.toBe(token);
  });

  it("rejects revoked, expired, used-up and unknown links", () => {
    const revoked = createInvite({ circleId, role: "viewer", createdBy: ownerId });
    db.update(schema.invites)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.invites.circleId, circleId), eq(schema.invites.role, "viewer")))
      .run();
    expect(findValidInvite(revoked)).toBeNull();

    const expired = createInvite({ circleId, role: "owner", createdBy: ownerId });
    db.update(schema.invites)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.invites.role, "owner"))
      .run();
    expect(findValidInvite(expired)).toBeNull();

    const single = createInvite({
      circleId,
      role: "caregiver",
      createdBy: ownerId,
      maxUses: 1,
      label: "single",
    });
    const stranger = addUser("Sam", "sam@test.local");
    expect(acceptInvite(single, stranger)).toBe(circleId);
    expect(findValidInvite(single)).toBeNull();
    expect(findValidInvite("does-not-exist")).toBeNull();
  });
});

describe("reminder scheduler", () => {
  const keys = (prefix: string) =>
    db
      .select()
      .from(schema.notificationLog)
      .where(like(schema.notificationLog.key, `${prefix}%`))
      .all()
      .map((r) => r.key);

  it("sends a due reminder exactly once", async () => {
    const at = zonedInstant("2026-11-04", "08:00", tz);
    await runReminderTick(new Date(at.getTime() + 2 * MINUTE));
    await runReminderTick(new Date(at.getTime() + 3 * MINUTE));
    expect(keys(`due:${medId}`)).toEqual([`due:${medId}:${at.getTime()}`]);
  });

  it("flags a dose nobody logged, but not one that was given", async () => {
    const missedAt = zonedInstant("2026-11-04", "20:00", tz);
    const givenAt = zonedInstant("2026-11-05", "08:00", tz);
    db.insert(schema.doseLogs)
      .values({
        id: newId(),
        circleId,
        medicationId: medId,
        scheduledFor: givenAt,
        status: "given",
        takenAt: givenAt,
        recordedBy: ownerId,
        createdAt: new Date(),
      })
      .run();
    await runReminderTick(new Date(missedAt.getTime() + 61 * MINUTE));
    await runReminderTick(new Date(givenAt.getTime() + 61 * MINUTE));
    expect(keys(`missed:${medId}`)).toEqual([`missed:${medId}:${missedAt.getTime()}`]);
  });

  it("reminds about open shifts within a day", async () => {
    const shiftId = newId();
    const start = zonedInstant("2026-11-06", "14:00", tz);
    db.insert(schema.shifts)
      .values({
        id: shiftId,
        circleId,
        startsAt: start,
        endsAt: new Date(start.getTime() + 4 * HOUR),
        assigneeId: null,
        createdAt: new Date(),
      })
      .run();
    await runReminderTick(new Date(start.getTime() - 3 * HOUR));
    expect(keys(`shift-open24:${shiftId}`)).toHaveLength(1);
  });
});

describe("secret rotation", () => {
  it("re-wraps circle keys with the new secret and keeps data readable", async () => {
    const before = listMedications({ circle: circleRow(), cipher: cipherFor(circleRow()) }).map(
      (m) => m.name,
    );
    const oldWrapped = circleRow().dataKey;
    const state = (
      globalThis as unknown as {
        __kinshiftKeys: {
          kek?: Buffer;
          previousKek?: Buffer | null;
          dataKeys: Map<string, Buffer>;
        };
      }
    ).__kinshiftKeys;
    process.env.KINSHIFT_PREVIOUS_SECRET = process.env.KINSHIFT_SECRET;
    process.env.KINSHIFT_SECRET = "a-brand-new-secret-that-is-long-enough-1234";
    state.kek = undefined;
    state.previousKek = undefined;
    forgetDataKey(circleId);

    const after = listMedications({ circle: circleRow(), cipher: cipherFor(circleRow()) }).map(
      (m) => m.name,
    );
    expect(after).toEqual(before);
    expect(circleRow().dataKey).not.toBe(oldWrapped);
  });
});
