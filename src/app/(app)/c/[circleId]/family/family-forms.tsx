"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { CopyButton, ShareButton, SubmitButton, useToastAction } from "@/components/ui/client";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { cn } from "@/lib/cn";
import { COLOR_CLASSES, COLOR_NAMES } from "@/lib/colors";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/roles";
import { changeRole, createInviteAction, updateMyMembership } from "./actions";

export function InviteForm({
  circleId,
  circleName,
  recipientName,
}: {
  circleId: string;
  circleName: string;
  recipientName: string;
}) {
  const [state, action] = useToastAction(createInviteAction, { success: false });
  const [role, setRole] = useState<"caregiver" | "viewer" | "owner">("caregiver");
  const url = state.status === "success" ? state.values?.inviteUrl : undefined;
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="circleId" value={circleId} />
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <Field label="They can" htmlFor="invite-role">
            <Select
              id="invite-role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
            >
              {(["caregiver", "viewer", "owner"] as const).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Who is it for?" htmlFor="invite-label" optional>
            <Input id="invite-label" name="label" placeholder="Priya and Sam" />
          </Field>
        </div>
        <p className="text-sm text-muted">{ROLE_DESCRIPTION[role]}</p>
        <SubmitButton pendingText="Creating…">
          <Link2 aria-hidden /> Create invite link
        </SubmitButton>
      </form>
      {url && (
        <div
          className="animate-slide-up rounded-xl border border-brand/30 bg-brand-soft p-3"
          data-testid="invite-link"
        >
          <p className="mb-2 text-sm font-medium text-brand-strong">
            Send this link to your family. It works for 7 days and up to 10 people, and is only
            shown once.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              readOnly
              value={url}
              aria-label="Invite link"
              className="font-mono text-xs"
              onFocus={(e) => e.target.select()}
            />
            <div className="flex gap-2">
              <CopyButton value={url} />
              <ShareButton
                url={url}
                title={`Join ${circleName} on Kinshift`}
                text={`I set up Kinshift so we can share caring for ${recipientName}. Join here:`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function RoleSelect({
  circleId,
  userId,
  role,
}: {
  circleId: string;
  userId: string;
  role: string;
}) {
  const [, action] = useToastAction(changeRole);
  return (
    <form action={action}>
      <input type="hidden" name="circleId" value={circleId} />
      <input type="hidden" name="userId" value={userId} />
      <Select
        name="role"
        defaultValue={role}
        aria-label="Role"
        className="h-9 w-36 text-sm"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {(["owner", "caregiver", "viewer"] as const).map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </Select>
    </form>
  );
}

export function MyDetailsForm({
  circleId,
  relationship,
  color,
}: {
  circleId: string;
  relationship: string;
  color: string;
}) {
  const [, action] = useToastAction(updateMyMembership);
  const [picked, setPicked] = useState(color);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="circleId" value={circleId} />
      <Field label="Your relationship" htmlFor="relationship" optional>
        <Input
          id="relationship"
          name="relationship"
          defaultValue={relationship}
          placeholder="Daughter, neighbour, home aide…"
        />
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Your colour on the schedule</legend>
        <div className="flex flex-wrap gap-2">
          {COLOR_NAMES.map((c) => (
            <label key={c} className="cursor-pointer">
              <input
                type="radio"
                name="color"
                value={c}
                checked={picked === c}
                onChange={() => setPicked(c)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "block size-8 rounded-full ring-offset-2 ring-offset-surface peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                  COLOR_CLASSES[c].dot,
                  picked === c && "ring-2 ring-fg",
                )}
                title={c}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <SubmitButton variant="outline">Save</SubmitButton>
    </form>
  );
}
