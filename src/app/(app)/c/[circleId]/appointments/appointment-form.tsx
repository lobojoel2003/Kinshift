"use client";

import { useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, SubmitButton, useToastAction } from "@/components/ui/client";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { APPOINTMENT_KINDS } from "@/lib/domain";
import { saveAppointment } from "./actions";

export type AppointmentFormValues = {
  id?: string;
  title: string;
  kind: string;
  date: string;
  start: string;
  end: string;
  location: string;
  provider: string;
  notes: string;
  assigneeId: string;
};

export function AppointmentForm({
  circleId,
  initial,
  members,
}: {
  circleId: string;
  initial: AppointmentFormValues;
  members: { userId: string; name: string }[];
}) {
  const [state, action] = useToastAction(saveAppointment);
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
  const v = (k: keyof AppointmentFormValues) => state.values?.[k] ?? initial[k] ?? "";

  return (
    <form ref={formRef} action={action} className="space-y-5" noValidate>
      <input type="hidden" name="circleId" value={circleId} />
      {initial.id && <input type="hidden" name="appointmentId" value={initial.id} />}
      <input ref={confirmRef} type="hidden" name="confirm" defaultValue="" />
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <Field label="What is it?" htmlFor="title" error={fe.title}>
          <Input
            id="title"
            name="title"
            required
            defaultValue={v("title")}
            placeholder="Cardiology follow-up"
            autoFocus={!initial.id}
            aria-invalid={!!fe.title}
          />
        </Field>
        <Field label="Type" htmlFor="kind">
          <Select id="kind" name="kind" defaultValue={v("kind")}>
            {APPOINTMENT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="Date" htmlFor="date" error={fe.date} className="col-span-2 sm:col-span-1">
          <Input id="date" name="date" type="date" required defaultValue={v("date")} />
        </Field>
        <Field label="Starts" htmlFor="start" error={fe.start}>
          <Input id="start" name="start" type="time" required defaultValue={v("start")} />
        </Field>
        <Field label="Ends" htmlFor="end" error={fe.end}>
          <Input id="end" name="end" type="time" required defaultValue={v("end")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Where" htmlFor="location" optional error={fe.location}>
          <Input
            id="location"
            name="location"
            defaultValue={v("location")}
            placeholder="St. Mary’s, 2nd floor"
          />
        </Field>
        <Field label="With" htmlFor="provider" optional error={fe.provider}>
          <Input
            id="provider"
            name="provider"
            defaultValue={v("provider")}
            placeholder="Dr. Okafor"
          />
        </Field>
      </div>
      <Field
        label="Who’s going with them"
        htmlFor="assigneeId"
        hint="The family is told if nobody is going yet."
      >
        <Select id="assigneeId" name="assigneeId" defaultValue={v("assigneeId")}>
          <option value="">Nobody yet</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Notes"
        htmlFor="notes"
        optional
        error={fe.notes}
        hint="Questions to ask, what to bring, transport details."
      >
        <Textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={v("notes")}
          placeholder={"Bring the medication list.\nAsk about the swelling in her ankles."}
        />
      </Field>
      <div className="flex justify-end">
        <SubmitButton
          size="lg"
          pendingText="Saving…"
          onClick={() => confirmRef.current && (confirmRef.current.value = "")}
        >
          {initial.id ? "Save changes" : "Add appointment"}
        </SubmitButton>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <TriangleAlert className="size-5 text-amber-600" aria-hidden />
            {state.confirm?.title ?? "Save anyway?"}
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
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            Change time
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
