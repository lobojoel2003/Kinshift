"use client";

import { useActionState } from "react";
import { SubmitButton, useToastAction } from "@/components/ui/client";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { Alert } from "@/components/ui/misc";
import { initialFormState } from "@/lib/form-state";
import { deleteCircle, updateCircle } from "./actions";

export function CircleSettingsForm({
  circle,
  timeZones,
}: {
  circle: {
    id: string;
    name: string;
    recipientName: string;
    timezone: string;
    coverageStart: string;
    coverageEnd: string;
    missedDoseGraceMinutes: number;
  };
  timeZones: string[];
}) {
  const [state, action] = useToastAction(updateCircle);
  const fe = state.fieldErrors ?? {};
  const v = (k: keyof typeof circle) => state.values?.[k] ?? String(circle[k]);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="circleId" value={circle.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Circle name" htmlFor="name" error={fe.name}>
          <Input id="name" name="name" defaultValue={v("name")} />
        </Field>
        <Field
          label="Name of the person cared for"
          htmlFor="recipientName"
          error={fe.recipientName}
        >
          <Input id="recipientName" name="recipientName" defaultValue={v("recipientName")} />
        </Field>
      </div>
      <Field
        label="Time zone"
        htmlFor="timezone"
        error={fe.timezone}
        hint="Changing it keeps dose times at the same local clock time."
      >
        <Select id="timezone" name="timezone" defaultValue={v("timezone")}>
          {(timeZones.includes(circle.timezone) ? timeZones : [circle.timezone, ...timeZones]).map(
            (z) => (
              <option key={z} value={z}>
                {z.replaceAll("_", " ")}
              </option>
            ),
          )}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Coverage from" htmlFor="coverageStart" error={fe.coverageStart}>
          <Input
            id="coverageStart"
            name="coverageStart"
            type="time"
            defaultValue={v("coverageStart")}
          />
        </Field>
        <Field
          label="Coverage until"
          htmlFor="coverageEnd"
          error={fe.coverageEnd}
          hint="Same time as “from” means 24 hours."
        >
          <Input id="coverageEnd" name="coverageEnd" type="time" defaultValue={v("coverageEnd")} />
        </Field>
        <Field
          label="Missed-dose alert after"
          htmlFor="missedDoseGraceMinutes"
          error={fe.missedDoseGraceMinutes}
          hint="Minutes past the dose time."
        >
          <Input
            id="missedDoseGraceMinutes"
            name="missedDoseGraceMinutes"
            type="number"
            min="15"
            max="720"
            defaultValue={v("missedDoseGraceMinutes")}
          />
        </Field>
      </div>
      <SubmitButton>Save settings</SubmitButton>
    </form>
  );
}

export function DeleteCircleForm({ circleId, name }: { circleId: string; name: string }) {
  const [state, action] = useActionState(deleteCircle, initialFormState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="circleId" value={circleId} />
      {state.status === "error" && <Alert tone="danger">{state.message}</Alert>}
      <Field
        label={
          <>
            Type <strong>{name}</strong> to confirm
          </>
        }
        htmlFor="confirmName"
      >
        <Input id="confirmName" name="confirmName" autoComplete="off" />
      </Field>
      <SubmitButton variant="danger" pendingText="Deleting…">
        Delete circle and all its data
      </SubmitButton>
    </form>
  );
}
