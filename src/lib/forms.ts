import { z } from "zod";
import { isDateString, isTimeString, isValidTimeZone } from "@/lib/time";

export { initialFormState, type FormState } from "@/lib/form-state";
import type { FormState } from "@/lib/form-state";

export function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) {
      out[key] = key in out ? `${out[key]},${value}` : value;
    }
  }
  return out;
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    out[key] ??= issue.message;
  }
  return out;
}

export function errorState(message: string, extra: Partial<FormState> = {}): FormState {
  return { status: "error", message, at: Date.now(), ...extra };
}

export function successState(message: string, extra: Partial<FormState> = {}): FormState {
  return { status: "success", message, at: Date.now(), ...extra };
}

export function invalid(error: z.ZodError, formData: FormData): FormState {
  return {
    status: "error",
    message: "Please check the highlighted fields.",
    fieldErrors: fieldErrors(error),
    values: formValues(formData),
    at: Date.now(),
  };
}

/* ------------------------------------------------------------------ */
/* Reusable field schemas                                              */
/* ------------------------------------------------------------------ */

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const text = (max: number, label = "This field") =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer.`).default("");

export const requiredText = (max: number, label = "This field") =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

export const optionalInt = (min: number, max: number, label = "This value") =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: `${label} must be a number.` })
      .int(`${label} must be a whole number.`)
      .min(min, `${label} must be at least ${min}.`)
      .max(max, `${label} must be at most ${max}.`)
      .optional(),
  );

export const optionalNumber = (min: number, max: number, label = "This value") =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: `${label} must be a number.` })
      .min(min, `${label} looks too low.`)
      .max(max, `${label} looks too high.`)
      .optional(),
  );

export const checkbox = z.preprocess(
  (v) => v === "on" || v === "true" || v === "1" || v === true,
  z.boolean(),
);

export const dateString = z
  .string({ error: "Pick a date." })
  .trim()
  .refine(isDateString, "Pick a valid date.");

export const optionalDate = z.preprocess(
  emptyToUndefined,
  z.string().trim().refine(isDateString, "Pick a valid date.").optional(),
);

export const timeString = z
  .string({ error: "Pick a time." })
  .trim()
  .refine(isTimeString, "Pick a valid time.");

export const timeZone = z.string().trim().refine(isValidTimeZone, "Pick a valid time zone.");

export const email = z
  .string({ error: "Enter your email address." })
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address.").max(254));

export const personName = requiredText(80, "Name");
