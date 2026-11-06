"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, SubmitButton, useToastAction, type FormAction } from "@/components/ui/client";
import { Field, Textarea } from "@/components/ui/form-controls";

/**
 * Gives an as-needed dose. If the server reports a safety limit (too soon, or
 * the daily maximum), it asks for explicit confirmation and a reason first.
 */
export function PrnGiveButton({
  action,
  circleId,
  medicationId,
  medName,
  allowed,
}: {
  action: FormAction;
  circleId: string;
  medicationId: string;
  medName: string;
  allowed: boolean;
}) {
  const [state, formAction, pending] = useToastAction(action);
  const [open, setOpen] = useState(false);
  const seen = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (state.at === seen.current) return;
    seen.current = state.at;
    setOpen(!!state.confirm);
  }, [state]);

  return (
    <>
      <form action={formAction}>
        <input type="hidden" name="circleId" value={circleId} />
        <input type="hidden" name="medicationId" value={medicationId} />
        <Button
          type="submit"
          size="sm"
          variant={allowed ? "primary" : "outline"}
          disabled={pending}
        >
          <Plus aria-hidden />
          Give dose
        </Button>
      </form>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-amber-600" aria-hidden />
            {state.confirm?.title ?? `Give ${medName}?`}
          </span>
        }
        description={
          <ul className="list-disc space-y-1 pl-5">
            {state.confirm?.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        }
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="circleId" value={circleId} />
          <input type="hidden" name="medicationId" value={medicationId} />
          <input type="hidden" name="override" value="1" />
          <Field
            label="Why is an extra dose needed?"
            htmlFor={`reason-${medicationId}`}
            hint="Your family will be notified."
          >
            <Textarea
              id={`reason-${medicationId}`}
              name="note"
              rows={2}
              required
              placeholder="e.g. Doctor said it’s okay, pain is severe"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton variant="danger">Give anyway</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
