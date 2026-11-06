import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { and, eq, lt, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sessions, users, type User } from "@/lib/db/schema";
import { newToken, sha256 } from "@/lib/id";
import { DAY } from "@/lib/time";

export const SESSION_COOKIE = "kinshift_session";
/** Sessions expire after this much inactivity. */
const SESSION_TTL = 30 * DAY;
/** Refresh the sliding expiry at most this often. */
const TOUCH_INTERVAL = DAY;

export async function isSecureRequest(): Promise<boolean> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto) return proto === "https";
  const url = process.env.KINSHIFT_URL;
  return url ? url.startsWith("https://") : false;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/** Create a session and set its cookie. Only callable from Server Actions and Route Handlers. */
export async function startSession(userId: string): Promise<void> {
  const token = newToken();
  const now = Date.now();
  const ua = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  getDb()
    .insert(sessions)
    .values({
      id: sha256(token),
      userId,
      createdAt: new Date(now),
      lastSeenAt: new Date(now),
      expiresAt: new Date(now + SESSION_TTL),
      userAgent: ua,
    })
    .run();
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isSecureRequest(),
    path: "/",
    // The cookie outlives the server-side expiry; the database decides validity.
    maxAge: 400 * 24 * 60 * 60,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token)
    getDb()
      .delete(sessions)
      .where(eq(sessions.id, sha256(token)))
      .run();
  jar.delete(SESSION_COOKIE);
}

export type SessionUser = Pick<
  User,
  | "id"
  | "email"
  | "name"
  | "hour12"
  | "notifyDoses"
  | "notifyMissed"
  | "notifyShifts"
  | "notifyAppointments"
  | "notifyJournal"
  | "notifyDiscreet"
  | "createdAt"
> & { sessionId: string };

/** The signed-in user for this request, or null. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const id = sha256(token);
  const db = getDb();
  const row = db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id))
    .get();
  if (!row) return null;
  const now = Date.now();
  if (row.session.expiresAt.getTime() <= now) {
    db.delete(sessions).where(eq(sessions.id, id)).run();
    return null;
  }
  if (now - row.session.lastSeenAt.getTime() > TOUCH_INTERVAL) {
    db.update(sessions)
      .set({ lastSeenAt: new Date(now), expiresAt: new Date(now + SESSION_TTL) })
      .where(eq(sessions.id, id))
      .run();
  }
  const u = row.user;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    hour12: u.hour12,
    notifyDoses: u.notifyDoses,
    notifyMissed: u.notifyMissed,
    notifyShifts: u.notifyShifts,
    notifyAppointments: u.notifyAppointments,
    notifyJournal: u.notifyJournal,
    notifyDiscreet: u.notifyDiscreet,
    createdAt: u.createdAt,
    sessionId: id,
  };
});

export function revokeOtherSessions(userId: string, keepSessionId: string) {
  getDb()
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)))
    .run();
}

export function purgeExpiredSessions() {
  getDb().delete(sessions).where(lt(sessions.expiresAt, new Date())).run();
}
