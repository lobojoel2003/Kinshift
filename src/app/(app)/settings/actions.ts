"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { endSession, getCurrentUser, revokeOtherSessions } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { circles, memberships, pushSubscriptions, sessions, users } from "@/lib/db/schema";
import {
  checkbox,
  email,
  errorState,
  invalid,
  personName,
  successState,
  type FormState,
} from "@/lib/forms";
import { newId } from "@/lib/id";
import { sendPush } from "@/lib/push";
import { rateLimit } from "@/lib/rate-limit";
import { MINUTE } from "@/lib/time";

const profileSchema = z.object({
  name: personName,
  email,
  hour12: z.enum(["true", "false"]),
});

export async function updateAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const db = getDb();
  const taken = db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, parsed.data.email), ne(users.id, user.id)))
    .get();
  if (taken)
    return errorState("Another account already uses that email.", {
      fieldErrors: { email: "Already in use." },
    });
  db.update(users)
    .set({
      name: parsed.data.name,
      email: parsed.data.email,
      hour12: parsed.data.hour12 === "true",
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .run();
  revalidatePath("/", "layout");
  return successState("Profile updated.");
}

const passwordSchema = z.object({
  current: z.string().min(1, "Enter your current password."),
  next: z.string().superRefine((v, ctx) => {
    const p = passwordProblem(v);
    if (p) ctx.addIssue({ code: "custom", message: p });
  }),
});

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!rateLimit(`pw:${user.id}`, 5, 15 * MINUTE).ok)
    return errorState("Too many attempts. Try again later.");
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const state = invalid(parsed.error, formData);
    delete state.values;
    return state;
  }
  const row = getDb().select().from(users).where(eq(users.id, user.id)).get();
  if (!row || !(await verifyPassword(parsed.data.current, row.passwordHash))) {
    return errorState("Your current password is not correct.", {
      fieldErrors: { current: "Incorrect password." },
    });
  }
  getDb()
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.next), updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .run();
  revokeOtherSessions(user.id, user.sessionId);
  return successState("Password changed. Other devices have been signed out.");
}

const prefsSchema = z.object({
  notifyDoses: checkbox,
  notifyMissed: checkbox,
  notifyShifts: checkbox,
  notifyAppointments: checkbox,
  notifyJournal: checkbox,
  notifyDiscreet: checkbox,
});

export async function updateNotificationPrefs(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = prefsSchema.parse(Object.fromEntries(formData));
  getDb().update(users).set(parsed).where(eq(users.id, user.id)).run();
  return successState("Notification preferences saved.");
}

const subscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

export async function savePushSubscription(
  input: unknown,
  userAgent?: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid subscription" };
  const { endpoint, keys } = parsed.data;
  getDb()
    .insert(pushSubscriptions)
    .values({
      id: newId(),
      userId: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent?.slice(0, 200) ?? null,
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth },
    })
    .run();
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || typeof endpoint !== "string") return { ok: false };
  getDb()
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, user.id)))
    .run();
  return { ok: true };
}

export async function sendTestPush(): Promise<{ ok: boolean; sent: number }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, sent: 0 };
  if (!rateLimit(`testpush:${user.id}`, 5, 10 * MINUTE).ok) return { ok: false, sent: 0 };
  const sent = await sendPush([user.id], {
    title: "Kinshift notifications are on",
    body: "This is how reminders for doses, shifts and appointments will look.",
    url: "/settings",
    tag: "test",
  });
  return { ok: sent > 0, sent };
}

export async function signOutOtherDevices(
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  revokeOtherSessions(user.id, user.sessionId);
  revalidatePath("/settings");
  return successState("Signed out of all other devices.");
}

export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const password = String(formData.get("password") ?? "");
  const db = getDb();
  const row = db.select().from(users).where(eq(users.id, user.id)).get();
  if (!row || !(await verifyPassword(password, row.passwordHash))) {
    return errorState("Your password is not correct.");
  }
  const mine = db
    .select({ circleId: memberships.circleId, role: memberships.role, name: circles.name })
    .from(memberships)
    .innerJoin(circles, eq(circles.id, memberships.circleId))
    .where(eq(memberships.userId, user.id))
    .all();
  const blocking: string[] = [];
  const soleMember: string[] = [];
  for (const m of mine) {
    const others =
      db
        .select({ n: count() })
        .from(memberships)
        .where(and(eq(memberships.circleId, m.circleId), ne(memberships.userId, user.id)))
        .get()?.n ?? 0;
    if (others === 0) {
      soleMember.push(m.circleId);
      continue;
    }
    if (m.role === "owner") {
      const otherOwners =
        db
          .select({ n: count() })
          .from(memberships)
          .where(
            and(
              eq(memberships.circleId, m.circleId),
              eq(memberships.role, "owner"),
              ne(memberships.userId, user.id),
            ),
          )
          .get()?.n ?? 0;
      if (otherOwners === 0) blocking.push(m.name);
    }
  }
  if (blocking.length > 0) {
    return errorState(
      `You’re the only organizer of ${blocking.join(", ")}. Make someone else an organizer first, so your family keeps access.`,
    );
  }
  db.transaction((tx) => {
    for (const id of soleMember) tx.delete(circles).where(eq(circles.id, id)).run();
    tx.delete(sessions).where(eq(sessions.userId, user.id)).run();
    tx.delete(users).where(eq(users.id, user.id)).run();
  });
  await endSession();
  redirect("/");
}
