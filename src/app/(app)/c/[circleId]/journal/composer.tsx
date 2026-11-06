"use client";

import { useActionState, useState } from "react";
import { SubmitButton, toastResult } from "@/components/ui/client";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { cn } from "@/lib/cn";
import type { JournalKind } from "@/lib/db/schema";
import { JOURNAL_KINDS, MOODS } from "@/lib/domain";
import { initialFormState, type FormState } from "@/lib/form-state";
import { addJournalEntry } from "./actions";

const placeholders: Record<JournalKind, string> = {
  handoff:
    "Ate a good lunch. Took a short walk. Seemed tired after 4pm. Evening meds are on the counter. Pharmacy closes at 6 tomorrow.",
  note: "Anything worth remembering…",
  vitals: "Optional note about the readings",
  incident: "What happened, when, and what you did. Include anything the doctor should know.",
};

export function Composer({
  circleId,
  recipientName,
  initialKind = "handoff",
}: {
  circleId: string;
  recipientName: string;
  initialKind?: JournalKind;
}) {
  const [kind, setKind] = useState<JournalKind>(initialKind);
  const [mood, setMood] = useState<number | null>(null);
  // React resets the form after each submission; clear the mood chips with it on success.
  const [state, action] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await addJournalEntry(prev, formData);
    if (result.status === "success") setMood(null);
    toastResult(result);
    return result;
  }, initialFormState);
  const fe = state.fieldErrors ?? {};
  const hint = kind === "vitals" ? undefined : JOURNAL_KINDS.find((k) => k.value === kind)?.hint;

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="circleId" value={circleId} />
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Entry type">
        {JOURNAL_KINDS.map((k) => (
          <label
            key={k.value}
            className={cn(
              "cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              kind === k.value
                ? "border-brand bg-brand-soft text-brand-strong"
                : "border-line-strong text-muted hover:bg-subtle",
            )}
          >
            <input
              type="radio"
              name="kind"
              value={k.value}
              checked={kind === k.value}
              onChange={() => setKind(k.value)}
              className="sr-only"
            />
            {k.label}
          </label>
        ))}
      </div>

      {kind === "vitals" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field
            label="Blood pressure"
            htmlFor="bpSystolic"
            error={fe.bpSystolic}
            className="col-span-2"
          >
            <div className="flex items-center gap-2">
              <Input
                id="bpSystolic"
                name="bpSystolic"
                defaultValue={state.values?.bpSystolic}
                type="number"
                inputMode="numeric"
                placeholder="120"
                aria-label="Systolic"
              />
              <span className="text-muted">/</span>
              <Input
                name="bpDiastolic"
                defaultValue={state.values?.bpDiastolic}
                type="number"
                inputMode="numeric"
                placeholder="80"
                aria-label="Diastolic"
              />
            </div>
          </Field>
          <Field label="Pulse" htmlFor="pulse" error={fe.pulse}>
            <Input
              id="pulse"
              name="pulse"
              defaultValue={state.values?.pulse}
              type="number"
              inputMode="numeric"
              placeholder="72"
            />
          </Field>
          <Field label="SpO₂ %" htmlFor="oxygen" error={fe.oxygen}>
            <Input
              id="oxygen"
              name="oxygen"
              defaultValue={state.values?.oxygen}
              type="number"
              inputMode="numeric"
              placeholder="97"
            />
          </Field>
          <Field
            label="Temperature"
            htmlFor="temperature"
            error={fe.temperature}
            className="col-span-2 sm:col-span-1"
          >
            <div className="flex gap-1.5">
              <Input
                id="temperature"
                name="temperature"
                defaultValue={state.values?.temperature}
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="98.6"
              />
              <Select name="temperatureUnit" aria-label="Temperature unit" className="w-20">
                <option value="F">°F</option>
                <option value="C">°C</option>
              </Select>
            </div>
          </Field>
          <Field label="Glucose" htmlFor="glucose" error={fe.glucose}>
            <Input
              id="glucose"
              name="glucose"
              defaultValue={state.values?.glucose}
              type="number"
              inputMode="numeric"
              placeholder="110"
            />
          </Field>
          <Field
            label="Weight"
            htmlFor="weight"
            error={fe.weight}
            className="col-span-2 sm:col-span-1"
          >
            <div className="flex gap-1.5">
              <Input
                id="weight"
                name="weight"
                defaultValue={state.values?.weight}
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="142"
              />
              <Select name="weightUnit" aria-label="Weight unit" className="w-20">
                <option value="lb">lb</option>
                <option value="kg">kg</option>
              </Select>
            </div>
          </Field>
        </div>
      )}

      <Field
        label={kind === "handoff" ? "Handoff for the next person" : "Entry"}
        htmlFor="body"
        error={fe.body}
        hint={hint}
      >
        <Textarea
          id="body"
          name="body"
          rows={kind === "vitals" ? 2 : 4}
          placeholder={placeholders[kind]}
          defaultValue={state.values?.body}
          aria-invalid={!!fe.body}
        />
      </Field>

      {kind !== "vitals" && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">How is {recipientName} doing?</legend>
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((m) => (
              <label
                key={m.value}
                className={cn(
                  "cursor-pointer rounded-xl border px-3 py-1.5 text-sm transition-colors",
                  mood === m.value
                    ? "border-brand bg-brand-soft font-medium text-brand-strong"
                    : "border-line-strong text-muted hover:bg-subtle",
                )}
              >
                <input
                  type="radio"
                  name="mood"
                  value={m.value}
                  checked={mood === m.value}
                  onChange={() => setMood(m.value)}
                  onClick={() => mood === m.value && setMood(null)}
                  className="sr-only"
                />
                {m.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">Encrypted before it’s saved.</p>
        <SubmitButton pendingText="Saving…">
          {kind === "handoff" ? "Share handoff" : "Save entry"}
        </SubmitButton>
      </div>
    </form>
  );
}
