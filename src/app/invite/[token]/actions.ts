"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { errorState, type FormState } from "@/lib/forms";
import { acceptInvite } from "@/lib/invites";

export async function joinCircle(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const token = String(formData.get("token") ?? "");
  const circleId = acceptInvite(token, user.id);
  if (!circleId) return errorState("This invite link has expired or was already used.");
  redirect(`/c/${circleId}?joined=1`);
}
