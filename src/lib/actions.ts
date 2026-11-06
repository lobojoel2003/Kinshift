import "server-only";
import { revalidatePath } from "next/cache";
import { authorizeCircle, ForbiddenError, type CircleContext } from "@/lib/auth/dal";
import { DecryptionError } from "@/lib/crypto";
import { errorState, type FormState } from "@/lib/forms";

/**
 * Runs a circle Server Action: authorizes the caller from the circle id in the
 * form, turns permission problems into friendly errors, and refreshes the
 * circle's pages afterwards.
 */
export async function circleAction(
  formData: FormData,
  need: "view" | "edit" | "admin",
  fn: (ctx: CircleContext) => Promise<FormState> | FormState,
): Promise<FormState> {
  const circleId = String(formData.get("circleId") ?? "");
  let result: FormState;
  let authorized = false;
  try {
    const ctx = await authorizeCircle(circleId, need);
    authorized = true;
    result = await fn(ctx);
  } catch (err) {
    if (err instanceof ForbiddenError) return errorState(err.message);
    if (err instanceof DecryptionError) {
      return errorState("This data could not be decrypted. Check the server's KINSHIFT_SECRET.");
    }
    // Redirects after a successful change are thrown too: refresh before rethrowing.
    if (authorized) revalidatePath(`/c/${circleId}`, "layout");
    throw err;
  }
  revalidatePath(`/c/${circleId}`, "layout");
  return result;
}

export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    String((err as { code: unknown }).code).startsWith("SQLITE_CONSTRAINT")
  );
}

export function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}
