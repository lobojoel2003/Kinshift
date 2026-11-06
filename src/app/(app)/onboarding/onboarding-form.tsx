"use client";

import { useActionState, useEffect, useState } from "react";
import { SubmitButton } from "@/components/ui/client";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { Alert } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { initialFormState } from "@/lib/form-state";
import { createCircleAction } from "./actions";

const coverageOptions = [
  { value: "day", label: "Daytime", hint: "8 AM to 8 PM" },
  { value: "allday", label: "Around the clock", hint: "24 hours" },
  { value: "custom", label: "Custom hours", hint: "Pick a window" },
] as const;

export function OnboardingForm({ timeZones }: { timeZones: string[] }) {
  const [state, action] = useActionState(createCircleAction, initialFormState);
  const [tz, setTz] = useState("UTC");
  const [name, setName] = useState("");
  const [coverage, setCoverage] = useState<string>("day");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- default to the browser time zone
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  }, []);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.status === "error" && state.message && <Alert tone="danger">{state.message}</Alert>}
      <Field
        label="Who are you caring for?"
        htmlFor="recipientName"
        error={fe.recipientName}
        hint="The name your family uses, like “Mom” or “Grandpa Joe”."
      >
        <Input
          id="recipientName"
          name="recipientName"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Mom"
          aria-invalid={!!fe.recipientName}
        />
      </Field>
      <Field
        label="Your relationship to them"
        htmlFor="relationship"
        optional
        error={fe.relationship}
      >
        <Input
          id="relationship"
          name="relationship"
          placeholder="Daughter, son, partner, friend…"
        />
      </Field>
      <Field label="Name this care circle" htmlFor="name" optional error={fe.name}>
        <Input id="name" name="name" placeholder={`Caring for ${name || "Mom"}`} />
      </Field>
      <Field
        label="Their time zone"
        htmlFor="timezone"
        error={fe.timezone}
        hint="Medication times and shifts follow the time where they live."
      >
        <Select id="timezone" name="timezone" value={tz} onChange={(e) => setTz(e.target.value)}>
          {(timeZones.includes(tz) ? timeZones : [tz, ...timeZones]).map((z) => (
            <option key={z} value={z}>
              {z.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </Field>
      <fieldset>
        <legend className="text-sm font-medium">When does someone need to be with them?</legend>
        <p className="mb-2 text-sm text-muted">
          Kinshift flags any hours in this window with nobody on duty.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {coverageOptions.map((o) => (
            <label
              key={o.value}
              className={cn(
                "cursor-pointer rounded-xl border px-3 py-2.5 text-sm transition-colors",
                coverage === o.value
                  ? "border-brand bg-brand-soft ring-1 ring-brand"
                  : "border-line-strong bg-surface hover:bg-subtle",
              )}
            >
              <input
                type="radio"
                name="coverage"
                value={o.value}
                checked={coverage === o.value}
                onChange={() => setCoverage(o.value)}
                className="sr-only"
              />
              <span className="block font-medium">{o.label}</span>
              <span className="block text-xs text-muted">{o.hint}</span>
            </label>
          ))}
        </div>
        {coverage === "custom" && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="From" htmlFor="coverageStart" error={fe.coverageStart}>
              <Input id="coverageStart" name="coverageStart" type="time" defaultValue="07:00" />
            </Field>
            <Field label="Until" htmlFor="coverageEnd" error={fe.coverageEnd}>
              <Input id="coverageEnd" name="coverageEnd" type="time" defaultValue="22:00" />
            </Field>
          </div>
        )}
      </fieldset>
      <SubmitButton size="lg" className="w-full" pendingText="Setting things up…">
        Create care circle
      </SubmitButton>
    </form>
  );
}
