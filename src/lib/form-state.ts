/** Shared shape returned by every form Server Action. Safe to import from client components. */
export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  /** Set when the action needs the user to confirm before saving (clashes, safety limits). */
  confirm?: { title: string; details: string[] };
  /** Changes on every result so client effects (toasts) fire even for identical messages. */
  at?: number;
};

export const initialFormState: FormState = { status: "idle" };
