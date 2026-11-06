import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { memberships, notificationLog, users, type Role } from "@/lib/db/schema";
import { sendPush, type PushPayload } from "@/lib/push";

export type NotifyKind = "doses" | "missed" | "shifts" | "appointments" | "journal";

const prefColumn = {
  doses: "notifyDoses",
  missed: "notifyMissed",
  shifts: "notifyShifts",
  appointments: "notifyAppointments",
  journal: "notifyJournal",
} as const;

export type Notice = {
  kind: NotifyKind;
  /** Full text, may include health details. */
  title: string;
  body: string;
  /** Wording without health details, used for people who chose discreet notifications. */
  discreetTitle?: string;
  discreetBody?: string;
  url: string;
  tag?: string;
  urgent?: boolean;
};

/**
 * Notify members of a circle who opted in to this kind of notification.
 * `to` narrows the audience to specific people; viewers are skipped unless named.
 */
export async function notifyCircle(
  circleId: string,
  notice: Notice,
  opts: { to?: string[]; exclude?: string[]; roles?: Role[] } = {},
): Promise<void> {
  try {
    const rows = getDb()
      .select({ user: users, role: memberships.role })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.circleId, circleId))
      .all();
    const roles = opts.roles ?? ["owner", "caregiver"];
    const audience = rows.filter(({ user, role }) => {
      if (opts.exclude?.includes(user.id)) return false;
      if (opts.to) return opts.to.includes(user.id);
      return roles.includes(role);
    });
    const full: string[] = [];
    const discreet: string[] = [];
    for (const { user } of audience) {
      if (!user[prefColumn[notice.kind]]) continue;
      (user.notifyDiscreet && (notice.discreetBody || notice.discreetTitle) ? discreet : full).push(
        user.id,
      );
    }
    const base: Omit<PushPayload, "title" | "body"> = {
      url: notice.url,
      tag: notice.tag,
      urgent: notice.urgent,
    };
    await Promise.all([
      sendPush(full, { ...base, title: notice.title, body: notice.body }),
      sendPush(discreet, {
        ...base,
        title: notice.discreetTitle ?? notice.title,
        body: notice.discreetBody ?? notice.body,
      }),
    ]);
  } catch (err) {
    console.error("[kinshift] Failed to send notifications", err);
  }
}

/** Records that a reminder was sent. Returns false if it had been sent before. */
export function claimNotification(key: string): boolean {
  const result = getDb()
    .insert(notificationLog)
    .values({ key, sentAt: new Date() })
    .onConflictDoNothing()
    .run();
  return result.changes > 0;
}
