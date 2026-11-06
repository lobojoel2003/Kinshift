import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import type { CircleCipher } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { circles, memberships, users, type Circle, type Role } from "@/lib/db/schema";
import { cipherFor } from "@/lib/keys";
import { canAdmin, canEdit } from "@/lib/roles";
import { getCurrentUser, type SessionUser } from "./session";

/**
 * Data Access Layer. Every page and Server Action goes through these helpers,
 * so authentication and circle membership are checked next to the data.
 */

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export type Member = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  relationship: string | null;
  color: string;
  joinedAt: Date;
};

export type CircleContext = {
  user: SessionUser;
  circle: Circle;
  role: Role;
  members: Member[];
  memberById: Map<string, Member>;
  cipher: CircleCipher;
  canEdit: boolean;
  canAdmin: boolean;
};

const loadMembers = cache((circleId: string): Member[] => {
  return getDb()
    .select({
      userId: memberships.userId,
      name: users.name,
      email: users.email,
      role: memberships.role,
      relationship: memberships.relationship,
      color: memberships.color,
      joinedAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.circleId, circleId))
    .orderBy(asc(memberships.createdAt))
    .all();
});

/** Load a circle for the current user, or null if they are not a member. */
export const getCircleContext = cache(async (circleId: string): Promise<CircleContext | null> => {
  const user = await getCurrentUser();
  if (!user || typeof circleId !== "string" || circleId.length > 64) return null;
  const row = getDb()
    .select({ circle: circles, role: memberships.role })
    .from(memberships)
    .innerJoin(circles, eq(circles.id, memberships.circleId))
    .where(and(eq(memberships.circleId, circleId), eq(memberships.userId, user.id)))
    .get();
  if (!row) return null;
  const members = loadMembers(circleId);
  return {
    user,
    circle: row.circle,
    role: row.role,
    members,
    memberById: new Map(members.map((m) => [m.userId, m])),
    cipher: cipherFor(row.circle),
    canEdit: canEdit(row.role),
    canAdmin: canAdmin(row.role),
  };
});

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** For pages: redirects to sign-in, or 404s for circles the user is not in. */
export async function requireCircle(
  circleId: string,
  need: "view" | "edit" | "admin" = "view",
): Promise<CircleContext> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ctx = await getCircleContext(circleId);
  if (!ctx) notFound();
  if (need === "edit" && !ctx.canEdit) redirect(`/c/${circleId}`);
  if (need === "admin" && !ctx.canAdmin) redirect(`/c/${circleId}`);
  return ctx;
}

/** For Server Actions: throws instead of redirecting so the action can report the error. */
export async function authorizeCircle(
  circleId: string,
  need: "view" | "edit" | "admin" = "edit",
): Promise<CircleContext> {
  const ctx = await getCircleContext(String(circleId));
  if (!ctx) throw new ForbiddenError("You are not a member of this care circle.");
  if (need === "edit" && !ctx.canEdit) throw new ForbiddenError("Viewers cannot make changes.");
  if (need === "admin" && !ctx.canAdmin) {
    throw new ForbiddenError("Only organizers can do that.");
  }
  return ctx;
}

export function userCircles(userId: string) {
  return getDb()
    .select({
      id: circles.id,
      name: circles.name,
      recipientName: circles.recipientName,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(circles, eq(circles.id, memberships.circleId))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(memberships.createdAt))
    .all();
}
