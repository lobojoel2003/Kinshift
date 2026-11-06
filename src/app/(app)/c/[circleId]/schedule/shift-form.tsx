"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, SubmitButton, useToastAction } from "@/components/ui/client";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { saveShift } from "./actions";

export type ShiftFormValues = {
  id?: string;
  date: string;
  start: string;
  end: string;
  assigneeId: string;
  note: string;
};

export function ShiftForm({
  circleId,
  initial,
  members,
}: {
  circleId: string;
  initial: ShiftFormValues;
  members: { userId: string; name: string }[];
}) {
  const [state, action] = useToastAction(saveShift);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const seen = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (state.at === seen.current) return;
    seen.current = state.at;
    setConfirmOpen(!!state.confirm);
  }, [state]);
  const fe = state.fieldErrors ?? {};
  const v = (k: keyof ShiftFormValues) => state.values?.[k] ?? initial[k] ?? "";
  const overnight = (start: string, end: string) => end !== "" && start !== "" && end <= start;
  const [times, setTimes] = useState({ start: initial.start, end: initial.end });

  return (
    <form ref={formRef} action={action} className="space-y-5" noValidate>
      <input type="hidden" name="circleId" value={circleId} />
      {initial.id && <input type="hidden" name="shiftId" value={initial.id} />}
      <input ref={confirmRef} type="hidden" name="confirm" defaultValue="" />
      <Field label="Date" htmlFor="date" error={fe.date}>
        <Input id="date" name="date" type="date" required defaultValue={v("date")} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Starts" htmlFor="start" error={fe.start}>
          <Input
            id="start"
            name="start"
            type="time"
            required
            defaultValue={v("start")}
            onChange={(e) => setTimes((t) => ({ ...t, start: e.target.value }))}
          />
        </Field>
        <Field
          label="Ends"
          htmlFor="end"
          error={fe.end}
          hint={
            overnight(times.start, times.end)
              ? "Ends the next morning (overnight shift)."
              : undefined
          }
        >
          <Input
            id="end"
            name="end"
            type="time"
            required
            defaultValue={v("end")}
            onChange={(e) => setTimes((t) => ({ ...t, end: e.target.value }))}
          />
        </Field>
      </div>
      <Field
        label="Who’s on duty"
        htmlFor="assigneeId"
        hint="Leave it open and the family gets asked to take it."
      >
        <Select id="assigneeId" name="assigneeId" defaultValue={v("assigneeId")}>
          <option value="">Open shift (needs someone)</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </Select>
      </Field>
      {!initial.id && (
        <Field label="Repeat" htmlFor="repeatWeeks">
          <Select
            id="repeatWeeks"
            name="repeatWeeks"
            defaultValue={state.values?.repeatWeeks ?? "1"}
          >
            <option value="1">Just once</option>
            <option value="4">Every week for 4 weeks</option>
            <option value="8">Every week for 8 weeks</option>
            <option value="12">Every week for 12 weeks</option>
            <option value="26">Every week for 6 months</option>
          </Select>
        </Field>
      )}
      <Field label="Note" htmlFor="note" optional error={fe.note}>
        <Textarea
          id="note"
          name="note"
          rows={2}
          defaultValue={v("note")}
          placeholder="Bring the pill organizer; Mom has physio at 3."
        />
      </Field>
      <div className="flex justify-end gap-2">
        <SubmitButton
          size="lg"
          pendingText="Saving…"
          onClick={() => confirmRef.current && (confirmRef.current.value = "")}
        >
          {initial.id ? "Save shift" : "Add shift"}
        </SubmitButton>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={state.confirm?.title ?? "Save anyway?"}
        description={
          <>
            <ul className="list-disc space-y-1 pl-5">
              {state.confirm?.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            <p className="mt-2">Double-booking is fine if two people really will be there.</p>
          </>
        }
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            Go back
          </Button>
          <Button
            onClick={() => {
              if (confirmRef.current) confirmRef.current.value = "1";
              setConfirmOpen(false);
              formRef.current?.requestSubmit();
            }}
          >
            Save anyway
          </Button>
        </div>
      </Dialog>
    </form>
  );
}
