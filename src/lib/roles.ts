import type { Role } from "@/lib/db/schema";

export const ROLES: Role[] = ["owner", "caregiver", "viewer"];

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Organizer",
  caregiver: "Caregiver",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  owner: "Can do everything, including inviting family and changing settings.",
  caregiver: "Can log doses, take shifts, add appointments and write in the journal.",
  viewer: "Can see everything but cannot make changes. Good for extended family.",
};

/** Can add or change care data (doses, shifts, appointments, journal). */
export function canEdit(role: Role): boolean {
  return role === "owner" || role === "caregiver";
}

/** Can manage the circle: family, invites, settings, deleting things. */
export function canAdmin(role: Role): boolean {
  return role === "owner";
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}
