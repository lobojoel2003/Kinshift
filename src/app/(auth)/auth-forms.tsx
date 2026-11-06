"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { SubmitButton } from "@/components/ui/client";
import { Field, Input } from "@/components/ui/form-controls";
import { Alert } from "@/components/ui/misc";
import { initialFormState } from "@/lib/form-state";
import { login, signup } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(login, initialFormState);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.status === "error" && state.message && <Alert tone="danger">{state.message}</Alert>}
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Email" htmlFor="email" error={fe.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          autoFocus
          defaultValue={state.values?.email}
          aria-invalid={!!fe.email}
        />
      </Field>
      <Field label="Password" htmlFor="password" error={fe.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={!!fe.password}
        />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}

export function SignupForm({
  invite,
  inviteEmailHint,
}: {
  invite?: string;
  inviteEmailHint?: string;
}) {
  const [state, action] = useActionState(signup, initialFormState);
  const [hour12, setHour12] = useState("true");
  useEffect(() => {
    const uses12 = new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hour12;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser clock preference after hydration
    setHour12(uses12 === false ? "false" : "true");
  }, []);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.status === "error" && state.message && <Alert tone="danger">{state.message}</Alert>}
      {invite && <input type="hidden" name="invite" value={invite} />}
      <input type="hidden" name="hour12" value={hour12} />
      <Field
        label="Your name"
        htmlFor="name"
        error={fe.name}
        hint="Shown to your family next to the things you log."
      >
        <Input
          id="name"
          name="name"
          autoComplete="name"
          required
          autoFocus
          defaultValue={state.values?.name}
          aria-invalid={!!fe.name}
        />
      </Field>
      <Field label="Email" htmlFor="email" error={fe.email} hint={inviteEmailHint}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.values?.email}
          aria-invalid={!!fe.email}
        />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        error={fe.password}
        hint="At least 10 characters. A short sentence works well."
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          aria-invalid={!!fe.password}
        />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingText="Creating your account…">
        {invite ? "Create account and join" : "Create account"}
      </SubmitButton>
      <p className="text-center text-xs text-muted">
        Your data stays on this server. See the{" "}
        <Link className="underline underline-offset-2" href="/privacy">
          privacy notes
        </Link>
        .
      </p>
    </form>
  );
}
