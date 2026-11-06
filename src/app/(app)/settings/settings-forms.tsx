"use client";

import { useActionState } from "react";
import { SubmitButton, useToastAction } from "@/components/ui/client";
import { Field, Input, Select, Switch } from "@/components/ui/form-controls";
import { Alert } from "@/components/ui/misc";
import { initialFormState } from "@/lib/form-state";
import { changePassword, deleteAccount, updateAccount, updateNotificationPrefs } from "./actions";

export function AccountForm({
  name,
  email,
  hour12,
}: {
  name: string;
  email: string;
  hour12: boolean;
}) {
  const [state, action] = useToastAction(updateAccount);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={fe.name}>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            defaultValue={state.values?.name ?? name}
          />
        </Field>
        <Field label="Email" htmlFor="email" error={fe.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.values?.email ?? email}
          />
        </Field>
      </div>
      <Field label="Time format" htmlFor="hour12">
        <Select
          id="hour12"
          name="hour12"
          defaultValue={state.values?.hour12 ?? String(hour12)}
          className="sm:w-60"
        >
          <option value="true">12-hour (2:30 PM)</option>
          <option value="false">24-hour (14:30)</option>
        </Select>
      </Field>
      <SubmitButton variant="outline">Save</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useToastAction(changePassword);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="text" name="username" autoComplete="username" hidden readOnly />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Current password" htmlFor="current" error={fe.current}>
          <Input id="current" name="current" type="password" autoComplete="current-password" />
        </Field>
        <Field label="New password" htmlFor="next" error={fe.next} hint="At least 10 characters.">
          <Input id="next" name="next" type="password" autoComplete="new-password" minLength={10} />
        </Field>
      </div>
      <SubmitButton variant="outline">Change password</SubmitButton>
    </form>
  );
}

const prefs = [
  {
    name: "notifyDoses",
    label: "Doses due",
    description: "When a scheduled dose is due and you’re on duty (or nobody is).",
  },
  {
    name: "notifyMissed",
    label: "Missed doses",
    description: "When a dose hasn’t been logged well after its time.",
  },
  {
    name: "notifyShifts",
    label: "Shifts and tasks",
    description: "Your shift is coming up, an open shift needs cover, a task is assigned to you.",
  },
  {
    name: "notifyAppointments",
    label: "Appointments",
    description: "New, changed or upcoming appointments.",
  },
  {
    name: "notifyJournal",
    label: "Handoffs and incidents",
    description: "When someone writes a handoff note or reports an incident.",
  },
] as const;

export function NotificationPrefsForm({
  values,
}: {
  values: Record<(typeof prefs)[number]["name"] | "notifyDiscreet", boolean>;
}) {
  const [, action] = useToastAction(updateNotificationPrefs);
  return (
    <form action={action} className="space-y-4">
      <div className="divide-y divide-line">
        {prefs.map((p) => (
          <Switch
            key={p.name}
            name={p.name}
            label={p.label}
            description={p.description}
            defaultChecked={values[p.name]}
            className="py-3"
          />
        ))}
        <Switch
          name="notifyDiscreet"
          label="Discreet wording"
          description="Leave medication names and health details out of notifications, so nothing sensitive shows on a lock screen."
          defaultChecked={values.notifyDiscreet}
          className="py-3"
        />
      </div>
      <SubmitButton variant="outline">Save preferences</SubmitButton>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccount, initialFormState);
  return (
    <form action={action} className="space-y-3">
      {state.status === "error" && <Alert tone="danger">{state.message}</Alert>}
      <input type="text" name="username" autoComplete="username" hidden readOnly />
      <Field label="Confirm with your password" htmlFor="delete-password">
        <Input
          id="delete-password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="sm:w-80"
        />
      </Field>
      <SubmitButton variant="danger" pendingText="Deleting…">
        Delete my account
      </SubmitButton>
    </form>
  );
}
