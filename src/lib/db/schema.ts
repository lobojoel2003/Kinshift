import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Kinshift data model.
 *
 * Columns ending in `Enc` hold AES-256-GCM ciphertext produced by
 * `src/lib/crypto.ts`. They are encrypted with the owning circle's data key,
 * so a copy of the database file on its own reveals no health details.
 * Structural data (times, ids, roles) stays in plaintext so it can be queried.
 */

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`);

export type Role = "owner" | "caregiver" | "viewer";
export type DoseStatus = "given" | "skipped";
export type ScheduleType = "scheduled" | "prn";
export type AppointmentStatus = "scheduled" | "done" | "cancelled";
export type JournalKind = "note" | "handoff" | "vitals" | "incident";
export type AppointmentKind = "doctor" | "therapy" | "lab" | "dental" | "vision" | "other";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  hour12: integer("hour12", { mode: "boolean" }).notNull().default(true),
  notifyDoses: integer("notify_doses", { mode: "boolean" }).notNull().default(true),
  notifyMissed: integer("notify_missed", { mode: "boolean" }).notNull().default(true),
  notifyShifts: integer("notify_shifts", { mode: "boolean" }).notNull().default(true),
  notifyAppointments: integer("notify_appointments", { mode: "boolean" }).notNull().default(true),
  notifyJournal: integer("notify_journal", { mode: "boolean" }).notNull().default(true),
  notifyDiscreet: integer("notify_discreet", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

export const sessions = sqliteTable(
  "sessions",
  {
    /** SHA-256 of the session token. The raw token only lives in the cookie. */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const circles = sqliteTable("circles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  recipientName: text("recipient_name").notNull(),
  timezone: text("timezone").notNull(),
  /** The circle's data key, wrapped (encrypted) with the instance key. */
  dataKey: text("data_key").notNull(),
  /** Daily window that should always have someone on duty, as HH:MM local time. */
  coverageStart: text("coverage_start").notNull().default("08:00"),
  coverageEnd: text("coverage_end").notNull().default("20:00"),
  missedDoseGraceMinutes: integer("missed_dose_grace_minutes").notNull().default(60),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const memberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    circleId: text("circle_id")
      .notNull()
      .references(() => circles.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<Role>().notNull(),
    relationship: text("relationship"),
    color: text("color").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("memberships_circle_user_uq").on(t.circleId, t.userId),
    index("memberships_user_idx").on(t.userId),
  ],
);

export const invites = sqliteTable(
  "invites",
  {
    id: text("id").primaryKey(),
    circleId: text("circle_id")
      .notNull()
      .references(() => circles.id, { onDelete: "cascade" }),
    /** SHA-256 of the invite token. */
    tokenHash: text("token_hash").notNull().unique(),
    role: text("role").$type<Role>().notNull(),
    label: text("label"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    maxUses: integer("max_uses").notNull().default(10),
    uses: integer("uses").notNull().default(0),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("invites_circle_idx").on(t.circleId)],
);

/** One row per circle: the care recipient's profile, stored as a single encrypted JSON document. */
export const profiles = sqliteTable("profiles", {
  circleId: text("circle_id")
    .primaryKey()
    .references(() => circles.id, { onDelete: "cascade" }),
  dataEnc: text("data_enc").notNull(),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const medications = sqliteTable(
  "medications",
  {
    id: text("id").primaryKey(),
    circleId: text("circle_id")
      .notNull()
      .references(() => circles.id, { onDelete: "cascade" }),
    /** Encrypted JSON: name, dosage, instructions, purpose, prescriber. */
    dataEnc: text("data_enc").notNull(),
    scheduleType: text("schedule_type").$type<ScheduleType>().notNull(),
    /** JSON array of local "HH:MM" times, for scheduled medications. */
    times: text("times", { mode: "json" }).$type<string[]>().notNull().default([]),
    /** JSON array of weekdays (0 = Sunday). Null means every day. */
    daysOfWeek: text("days_of_week", { mode: "json" }).$type<number[] | null>(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date"),
    minIntervalMinutes: integer("min_interval_minutes"),
    maxPerDay: integer("max_per_day"),
    doseQuantity: integer("dose_quantity").notNull().default(1),
    stockCount: integer("stock_count"),
    stockAlertAt: integer("stock_alert_at"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    color: text("color").notNull().default("teal"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("medications_circle_idx").on(t.circleId)],
);

export const doseLogs = sqliteTable(
  "dose_logs",
  {
    id: text("id").primaryKey(),
    circleId: text("circle_id")
      .notNull()
      .references(() => circles.id, { onDelete: "cascade" }),
    medicationId: text("medication_id")
      .notNull()
      .references(() => medications.id, { onDelete: "cascade" }),
    /** The scheduled dose this log answers. Null for as-needed doses. */
    scheduledFor: integer("scheduled_for", { mode: "timestamp_ms" }),
    status: text("status").$type<DoseStatus>().notNull(),
    takenAt: integer("taken_at", { mode: "timestamp_ms" }).notNull(),
    recordedBy: text("recorded_by").references(() => users.id, { onDelete: "set null" }),
    noteEnc: text("note_enc"),
    createdAt: createdAt(),
  },
  (t) => [
    // The database itself refuses to record the same scheduled dose twice.
    uniqueIndex("dose_logs_med_scheduled_uq").on(t.medicationId, t.scheduledFor),
    index("dose_logs_circle_taken_idx").on(t.circleId, t.takenAt),
  ],
);

export const appointments = sqliteTable(
  "appointments",
  {
    id: text("id").primaryKey(),
    circleId: text("circle_id")
      .notNull()
      .references(() => circles.id, { onDelete: "cascade" }),
    /** Encrypted JSON: title, location, provider, notes. */
    dataEnc: text("data_enc").notNull(),
    kind: text("kind").$type<AppointmentKind>().notNull().default("doctor"),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status").$type<AppointmentStatus>().notNull().default("scheduled"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("appointments_circle_start_idx").on(t.circleId, t.startsAt)],
);

export const shifts = sqliteTable(
  "shifts",
  {
    id: text("id").primaryKey(),
    circleId: text("circle_id")
      .notNull()
      .references(() => circles.id, { onDelete: "cascade" }),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    /** Null means the shift is open and needs someone to claim it. */
    assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
    noteEnc: text("note_enc"),
    seriesId: text("series_id"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("shifts_circle_start_idx").on(t.circleId, t.startsAt),
    index("shifts_series_idx").on(t.seriesId),
  ],
);

export const journalEntries = sqliteTable(
  "journal_entries",
  {
    id: text("id").primaryKey(),
    circleId: text("circle_id")
      .notNull()
      .references(() => circles.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    kind: text("kind").$type<JournalKind>().notNull(),
    bodyEnc: text("body_enc").notNull(),
    /** 1 (very low) to 5 (great). */
    mood: integer("mood"),
    vitalsEnc: text("vitals_enc"),
    createdAt: createdAt(),
  },
  (t) => [index("journal_circle_created_idx").on(t.circleId, t.createdAt)],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    circleId: text("circle_id")
      .notNull()
      .references(() => circles.id, { onDelete: "cascade" }),
    titleEnc: text("title_enc").notNull(),
    dueDate: text("due_date"),
    assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
    doneAt: integer("done_at", { mode: "timestamp_ms" }),
    doneBy: text("done_by").references(() => users.id, { onDelete: "set null" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("tasks_circle_idx").on(t.circleId)],
);

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("push_user_idx").on(t.userId)],
);

/** Remembers which reminders were already sent so restarts never send duplicates. */
export const notificationLog = sqliteTable("notification_log", {
  key: text("key").primaryKey(),
  sentAt: integer("sent_at", { mode: "timestamp_ms" }).notNull(),
});

export const activity = sqliteTable(
  "activity",
  {
    id: text("id").primaryKey(),
    circleId: text("circle_id")
      .notNull()
      .references(() => circles.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    /** Encrypted JSON with the details needed to render the event. */
    dataEnc: text("data_enc").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("activity_circle_created_idx").on(t.circleId, t.createdAt)],
);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type User = typeof users.$inferSelect;
export type Circle = typeof circles.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Medication = typeof medications.$inferSelect;
export type DoseLog = typeof doseLogs.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type Shift = typeof shifts.$inferSelect;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Invite = typeof invites.$inferSelect;
