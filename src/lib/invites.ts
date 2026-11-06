import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { circles, invites, memberships, users, type Role } from "@/lib/db/schema";
import { nextColor } from "@/lib/colors";
import { newId, newToken, sha256 } from "@/lib/id";
import { cipherFor } from "@/lib/keys";
import { logActivity } from "@/lib/activity";
import { DAY } from "@/lib/time";

export const INVITE_TTL_DAYS = 7;

export function createInvite(input: {
  circleId: string;
  role: Role;
  createdBy: string;
  label?: string | null;
  maxUses?: number;
}): string {
  const token = newToken();
  getDb()
    .insert(invites)
    .values({
      id: newId(),
      circleId: input.circleId,
      tokenHash: sha256(token),
      role: input.role,
      label: input.label || null,
      createdBy: input.createdBy,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * DAY),
      maxUses: input.maxUses ?? 10,
    })
    .run();
  return token;
}

export type InviteLookup = {
  inviteId: string;
  circleId: string;
  circleName: string;
  recipientName: string;
  role: Role;
  inviterName: string | null;
  expiresAt: Date;
};

export function findValidInvite(token: string): InviteLookup | null {
  if (!token || token.length > 100) return null;
  const row = getDb()
    .select({
      invite: invites,
      circleName: circles.name,
      recipientName: circles.recipientName,
      inviterName: users.name,
    })
    .from(invites)
    .innerJoin(circles, eq(circles.id, invites.circleId))
    .leftJoin(users, eq(users.id, invites.createdBy))
    .where(eq(invites.tokenHash, sha256(token)))
    .get();
  if (!row) return null;
  const inv = row.invite;
  if (inv.revokedAt || inv.expiresAt.getTime() <= Date.now() || inv.uses >= inv.maxUses)
    return null;
  return {
    inviteId: inv.id,
    circleId: inv.circleId,
    circleName: row.circleName,
    recipientName: row.recipientName,
    role: inv.role,
    inviterName: row.inviterName,
    expiresAt: inv.expiresAt,
  };
}

/** Join the circle behind an invite. Safe to call twice. Returns the circle id, or null if invalid. */
export function acceptInvite(token: string, userId: string): string | null {
  const db = getDb();
  return db.transaction((tx) => {
    const invite = findValidInvite(token);
    if (!invite) return null;
    const existing = tx
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.circleId, invite.circleId), eq(memberships.userId, userId)))
      .get();
    if (existing) return invite.circleId;
    const used = tx
      .select({ color: memberships.color })
      .from(memberships)
      .where(eq(memberships.circleId, invite.circleId))
      .all()
      .map((m) => m.color);
    tx.insert(memberships)
      .values({
        id: newId(),
        circleId: invite.circleId,
        userId,
        role: invite.role,
        color: nextColor(used),
        createdAt: new Date(),
      })
      .run();
    tx.update(invites)
      .set({ uses: sql`${invites.uses} + 1` })
      .where(eq(invites.id, invite.inviteId))
      .run();
    const circle = tx.select().from(circles).where(eq(circles.id, invite.circleId)).get()!;
    logActivity({ circleId: circle.id, cipher: cipherFor(circle) }, userId, "member.joined");
    return invite.circleId;
  });
}
