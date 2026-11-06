"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { initialFormState, type FormState } from "@/lib/form-state";
import { Button, type ButtonSize, type ButtonVariant } from "./button";

export type FormAction = (prev: FormState, formData: FormData) => Promise<FormState>;

/** Show the toast for an action result (errors, and successes unless disabled). */
export function toastResult(state: FormState, opts: { success?: boolean } = {}) {
  if (state.status === "error" && state.confirm) return;
  if (state.status === "error" && state.fieldErrors) {
    toast.error(state.message ?? "Please check the form.");
  } else if (state.status === "error" && state.message) {
    toast.error(state.message);
  } else if (state.status === "success" && state.message && opts.success !== false) {
    toast.success(state.message);
  }
}

/**
 * `useActionState` that toasts each result as soon as the action returns. The
 * toast is raised from the action itself rather than an effect, so it still
 * shows when the result makes the button that triggered it disappear.
 */
export function useToastAction(action: FormAction, opts: { success?: boolean } = {}) {
  return useActionState(async (prev: FormState, formData: FormData) => {
    const result = await action(prev, formData);
    toastResult(result, opts);
    return result;
  }, initialFormState);
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-hidden className={cn("animate-spin", className)} />;
}

export function SubmitButton({
  children,
  pendingText,
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & {
  pendingText?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={pending || props.disabled}
      aria-busy={pending}
      className={className}
      {...props}
    >
      {pending ? (
        <>
          <Spinner />
          {pendingText ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

/** A modal built on the native <dialog> element. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-surface p-0 text-fg shadow-pop open:animate-slide-up",
        className,
      )}
    >
      <div className="p-5">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && <div className="mt-1 text-sm text-muted">{description}</div>}
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  );
}

/**
 * A one-button form for a Server Action, with optional confirmation dialog.
 * `fields` become hidden inputs.
 */
export function ActionButton({
  action,
  fields,
  children,
  variant = "outline",
  size = "sm",
  className,
  confirm,
  title,
  disabled,
  onDone,
}: {
  action: FormAction;
  fields: Record<string, string | number | null | undefined>;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  title?: string;
  disabled?: boolean;
  confirm?: { title: string; body?: ReactNode; confirmLabel?: string; danger?: boolean };
  onDone?: (state: FormState) => void;
}) {
  const [state, formAction, pending] = useToastAction(action);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const lastAt = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (state.at && state.at !== lastAt.current) {
      lastAt.current = state.at;
      onDone?.(state);
    }
  }, [state, onDone]);

  return (
    <form ref={formRef} action={formAction} className="contents">
      {Object.entries(fields).map(([k, v]) =>
        v === null || v === undefined ? null : (
          <input key={k} type="hidden" name={k} value={String(v)} />
        ),
      )}
      <Button
        type={confirm ? "button" : "submit"}
        variant={variant}
        size={size}
        className={className}
        title={title}
        aria-label={title}
        disabled={pending || disabled}
        aria-busy={pending}
        onClick={confirm ? () => setOpen(true) : undefined}
      >
        {pending ? <Spinner /> : null}
        {children}
      </Button>
      {confirm && (
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title={confirm.title}
          description={confirm.body}
        >
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={confirm.danger ? "danger" : "primary"}
              onClick={() => {
                setOpen(false);
                formRef.current?.requestSubmit();
              }}
            >
              {confirm.confirmLabel ?? "Confirm"}
            </Button>
          </div>
        </Dialog>
      )}
    </form>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("Copied to clipboard");
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("Could not copy. Select the text and copy it manually.");
        }
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : label}
    </Button>
  );
}

export function ShareButton({ url, title, text }: { url: string; title: string; text: string }) {
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection after hydration
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);
  if (!canShare) return null;
  return (
    <Button
      variant="primary"
      size="sm"
      onClick={() => navigator.share({ url, title, text }).catch(() => undefined)}
    >
      <Share2 />
      Share
    </Button>
  );
}

/**
 * Keeps shared screens fresh: when one sibling logs a dose, everyone else
 * sees it within half a minute, and immediately when they return to the app.
 */
export function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const busy = () => {
      const el = document.activeElement;
      return (
        !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")
      );
    };
    const tick = () => {
      if (
        document.visibilityState === "visible" &&
        !busy() &&
        !document.querySelector("dialog[open]")
      ) {
        router.refresh();
      }
    };
    const start = () => {
      clearInterval(timer);
      timer = setInterval(tick, intervalMs);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        tick();
        start();
      } else clearInterval(timer);
    };
    start();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", tick);
    };
  }, [router, intervalMs]);
  return null;
}

/** Fills a hidden input with the browser's time zone (used on sign-up and onboarding). */
export function TimeZoneInput({ name = "timezone" }: { name?: string }) {
  const [tz, setTz] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser time zone after hydration
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);
  return <input type="hidden" name={name} value={tz} />;
}
