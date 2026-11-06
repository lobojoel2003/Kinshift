"use server";

import { redirect } from "next/navigation";
import { and, count, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { circleAction, str } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { isColorName } from "@/lib/colors";
import { getDb } from "@/lib/db";
import { invites, memberships } from "@/lib/db/schema";
import { errorState, successState, text, type FormState } from "@/lib/forms";
import { createInvite } from "@/lib/invites";
import { isRole } from "@/lib/roles";
import { appBaseUrl } from "@/lib/urls";

function ownerCount(circleId: string) {
  return (
    getDb()
      .select({ n: count() })
      .from(memberships)
      .where(and(eq(memberships.circleId, circleId), eq(memberships.role, "owner")))
      .get()?.n ?? 0
  );
}

export async function createInviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "admin", async (ctx) => {
    const role = str(formData, "role");
    if (!isRole(role)) return errorState("Pick a role for the invite.");
    const label = text(60, "Label").safeParse(str(formData, "label"));
    const active =
      getDb()
        .select({ n: count() })
        .from(invites)
        .where(and(eq(invites.circleId, ctx.circle.id), isNull(invites.revokedAt)))
        .get()?.n ?? 0;
    if (active >= 50) return errorState("Too many invite links. Revoke some old ones first.");
    const token = createInvite({
      circleId: ctx.circle.id,
      role,
      createdBy: ctx.user.id,
      label: label.success ? label.data : null,
    });
    logActivity({ circleId: ctx.circle.id, cipher: ctx.cipher }, ctx.user.id, "invite.created");
    return successState("Invite link created.", {
      values: { inviteUrl: `${await appBaseUrl()}/invite/${token}` },
    });
  });
}

export async function revokeInvite(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "admin", (ctx) => {
    getDb()
      .update(invites)
      .set({ revokedAt: new Date() })
      .where(and(eq(invites.id, str(formData, "inviteId")), eq(invites.circleId, ctx.circle.id)))
      .run();
    return successState("Invite link revoked. It can no longer be used.");
  });
}

export async function changeRole(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "admin", (ctx) => {
    const userId = str(formData, "userId");
    const role = str(formData, "role");
    const member = ctx.memberById.get(userId);
    if (!member) return errorState("That person is no longer in this circle.");
    if (!isRole(role)) return errorState("Unknown role.");
    if (member.role === "owner" && role !== "owner" && ownerCount(ctx.circle.id) <= 1) {
      return errorState(
        "Every circle needs at least one organizer. Make someone else an organizer first.",
      );
    }
    getDb()
      .update(memberships)
      .set({ role })
      .where(and(eq(memberships.circleId, ctx.circle.id), eq(memberships.userId, userId)))
      .run();
    logActivity({ circleId: ctx.circle.id, cipher: ctx.cipher }, ctx.user.id, "member.role", {
      name: member.name,
      role,
    });
    return successState(
      `${member.name} is now ${role === "owner" ? "an organizer" : `a ${role}`}.`,
    );
  });
}

export async function removeMember(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "admin", (ctx) => {
    const userId = str(formData, "userId");
    const member = ctx.memberById.get(userId);
    if (!member) return errorState("That person is no longer in this circle.");
    if (userId === ctx.user.id)
      return errorState("To leave the circle yourself, use “Leave circle”.");
    if (member.role === "owner" && ownerCount(ctx.circle.id) <= 1) {
      return errorState("You can’t remove the last organizer.");
    }
    getDb()
      .delete(memberships)
      .where(and(eq(memberships.circleId, ctx.circle.id), eq(memberships.userId, userId)))
      .run();
    logActivity({ circleId: ctx.circle.id, cipher: ctx.cipher }, ctx.user.id, "member.removed", {
      name: member.name,
    });
    return successState(`${member.name} was removed from the circle.`);
  });
}

export async function leaveCircle(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "view", (ctx) => {
    if (ctx.members.length === 1) {
      return errorState("You’re the only member. Delete the circle from its settings instead.");
    }
    if (ctx.role === "owner" && ownerCount(ctx.circle.id) <= 1) {
      return errorState(
        "You’re the only organizer. Make someone else an organizer before you leave.",
      );
    }
    getDb()
      .delete(memberships)
      .where(and(eq(memberships.circleId, ctx.circle.id), eq(memberships.userId, ctx.user.id)))
      .run();
    logActivity({ circleId: ctx.circle.id, cipher: ctx.cipher }, ctx.user.id, "member.left");
    redirect("/");
  });
}

const myDetails = z.object({
  relationship: text(40, "Relationship"),
  color: z.string().refine(isColorName, "Pick a colour."),
});

export async function updateMyMembership(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "view", (ctx) => {
    const parsed = myDetails.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return errorState(parsed.error.issues[0]?.message ?? "Check the form.");
    getDb()
      .update(memberships)
      .set({ relationship: parsed.data.relationship || null, color: parsed.data.color })
      .where(and(eq(memberships.circleId, ctx.circle.id), eq(memberships.userId, ctx.user.id)))
      .run();
    return successState("Your details were updated.");
  });
}
