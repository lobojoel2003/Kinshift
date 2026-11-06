"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getDummyHash, hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { clientIp, endSession, startSession } from "@/lib/auth/session";
import { userCount, firstCircleId } from "@/lib/circles";
import { registrationMode } from "@/lib/env";
import { email, errorState, invalid, personName, type FormState } from "@/lib/forms";
import { newId } from "@/lib/id";
import { acceptInvite, findValidInvite } from "@/lib/invites";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { HOUR, MINUTE } from "@/lib/time";
import { safeNext } from "@/lib/urls";

const signupSchema = z.object({
  name: personName,
  email,
  password: z.string().superRefine((value, ctx) => {
    const problem = passwordProblem(value);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  }),
  invite: z.string().max(100).optional(),
  hour12: z.string().optional(),
});

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await clientIp();
  const limited = rateLimit(`signup:${ip}`, 10, HOUR);
  if (!limited.ok) return errorState("Too many sign-up attempts. Please try again later.");

  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const state = invalid(parsed.error, formData);
    delete state.values?.password;
    return state;
  }
  const { name, email: emailAddress, password, invite } = parsed.data;

  const inviteInfo = invite ? findValidInvite(invite) : null;
  if (invite && !inviteInfo) {
    return errorState("This invite link has expired or was already used. Ask for a new one.");
  }
  if (!inviteInfo && registrationMode() === "invite" && userCount() > 0) {
    return errorState("New accounts need an invite link from someone already using Kinshift.");
  }

  const db = getDb();
  if (db.select({ id: users.id }).from(users).where(eq(users.email, emailAddress)).get()) {
    return {
      status: "error",
      message: "An account with this email already exists. Try signing in instead.",
      fieldErrors: { email: "Already registered." },
      values: { name, email: emailAddress },
      at: Date.now(),
    };
  }

  const id = newId();
  db.insert(users)
    .values({
      id,
      name,
      email: emailAddress,
      passwordHash: await hashPassword(password),
      hour12: parsed.data.hour12 !== "false",
      createdAt: new Date(),
    })
    .run();
  await startSession(id);

  if (invite) {
    const circleId = acceptInvite(invite, id);
    if (circleId) redirect(`/c/${circleId}?joined=1`);
  }
  redirect("/onboarding");
}

const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(200),
  next: z.string().optional(),
});

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const state = invalid(parsed.error, formData);
    delete state.values?.password;
    return state;
  }
  const { email: emailAddress, password, next } = parsed.data;
  const ip = await clientIp();
  const key = `login:${ip}:${emailAddress}`;
  const limited = rateLimit(key, 8, 15 * MINUTE);
  if (!limited.ok) {
    const minutes = Math.ceil(limited.retryAfterMs / MINUTE);
    return errorState(
      `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      {
        values: { email: emailAddress },
      },
    );
  }

  const user = getDb().select().from(users).where(eq(users.email, emailAddress)).get();
  const ok = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !ok) {
    return errorState("That email and password don't match.", { values: { email: emailAddress } });
  }
  resetRateLimit(key);
  await startSession(user.id);

  const target = safeNext(next, "");
  if (target) redirect(target);
  const circleId = firstCircleId(user.id);
  redirect(circleId ? `/c/${circleId}` : "/onboarding");
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/login");
}
