"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubmitButton, useToastAction } from "@/components/ui/client";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import type { ProfileData } from "@/lib/domain";
import { saveProfile } from "./actions";

type Row = { name: string; b: string; phone: string };

function RowList({
  title,
  prefix,
  bKey,
  bLabel,
  initial,
  addLabel,
}: {
  title: string;
  prefix: string;
  bKey: string;
  bLabel: string;
  initial: Row[];
  addLabel: string;
}) {
  const [rows, setRows] = useState<(Row & { key: number })[]>(
    (initial.length ? initial : [{ name: "", b: "", phone: "" }]).map((r, i) => ({ ...r, key: i })),
  );
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm font-medium">{title}</legend>
      {rows.map((r, i) => (
        <div
          key={r.key}
          className="grid grid-cols-[1fr_auto] gap-2 rounded-xl bg-subtle/60 p-2 sm:grid-cols-[1.2fr_1fr_1fr_auto]"
        >
          <Input
            name={`${prefix}Name`}
            defaultValue={r.name}
            placeholder="Name"
            aria-label={`${title} ${i + 1} name`}
          />
          <Input
            name={`${prefix}${bKey}`}
            defaultValue={r.b}
            placeholder={bLabel}
            aria-label={`${title} ${i + 1} ${bLabel}`}
            className="col-start-1 sm:col-start-auto"
          />
          <Input
            name={`${prefix}Phone`}
            type="tel"
            defaultValue={r.phone}
            placeholder="Phone"
            aria-label={`${title} ${i + 1} phone`}
            className="col-start-1 sm:col-start-auto"
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${title.toLowerCase()} ${i + 1}`}
            className="col-start-2 row-span-3 row-start-1 self-start sm:col-start-auto sm:row-span-1 sm:row-start-auto"
            onClick={() => setRows(rows.filter((x) => x.key !== r.key))}
          >
            <X />
          </Button>
        </div>
      ))}
      <Button
        variant="soft"
        size="sm"
        onClick={() => setRows([...rows, { name: "", b: "", phone: "", key: Date.now() }])}
      >
        <Plus /> {addLabel}
      </Button>
    </fieldset>
  );
}

export function ProfileForm({
  circleId,
  recipientName,
  initial,
}: {
  circleId: string;
  recipientName: string;
  initial: ProfileData;
}) {
  const [state, action] = useToastAction(saveProfile);
  const fe = state.fieldErrors ?? {};
  const v = (k: keyof ProfileData) =>
    (state.values?.[k] as string | undefined) ?? (initial[k] as string);
  const section = "space-y-4 rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5";

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="circleId" value={circleId} />
      <section className={section}>
        <h2 className="font-semibold">About {recipientName}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Preferred name" htmlFor="preferredName" optional error={fe.preferredName}>
            <Input
              id="preferredName"
              name="preferredName"
              defaultValue={v("preferredName")}
              placeholder="Margaret, “Peggy”"
            />
          </Field>
          <Field label="Date of birth" htmlFor="dateOfBirth" optional error={fe.dateOfBirth}>
            <Input
              id="dateOfBirth"
              name="dateOfBirth"
              type="date"
              defaultValue={v("dateOfBirth")}
            />
          </Field>
          <Field label="Pronouns" htmlFor="pronouns" optional>
            <Input
              id="pronouns"
              name="pronouns"
              defaultValue={v("pronouns")}
              placeholder="she/her"
            />
          </Field>
        </div>
      </section>

      <section className={section}>
        <h2 className="font-semibold">Health</h2>
        <Field
          label="Allergies"
          htmlFor="allergies"
          hint="Shown in red on the profile and the emergency card."
          error={fe.allergies}
        >
          <Textarea
            id="allergies"
            name="allergies"
            rows={2}
            defaultValue={v("allergies")}
            placeholder="Penicillin (hives), shellfish"
          />
        </Field>
        <Field label="Conditions" htmlFor="conditions" error={fe.conditions}>
          <Textarea
            id="conditions"
            name="conditions"
            rows={3}
            defaultValue={v("conditions")}
            placeholder="Type 2 diabetes, mild dementia, atrial fibrillation"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <Field label="Blood type" htmlFor="bloodType">
            <Select id="bloodType" name="bloodType" defaultValue={v("bloodType")}>
              <option value="">Not set</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"].map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Advance directive / DNR" htmlFor="advanceDirective" optional>
            <Input
              id="advanceDirective"
              name="advanceDirective"
              defaultValue={v("advanceDirective")}
              placeholder="Living will in the blue folder, hall closet"
            />
          </Field>
        </div>
        <Field label="Other medical notes" htmlFor="medicalNotes" optional>
          <Textarea
            id="medicalNotes"
            name="medicalNotes"
            rows={3}
            defaultValue={v("medicalNotes")}
          />
        </Field>
      </section>

      <section className={section}>
        <h2 className="font-semibold">Daily life</h2>
        <p className="-mt-2 text-sm text-muted">
          What a new helper needs to know to do a good shift.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mobility" htmlFor="mobility" optional>
            <Textarea
              id="mobility"
              name="mobility"
              rows={2}
              defaultValue={v("mobility")}
              placeholder="Walker indoors, wheelchair for outings. Fall risk at night."
            />
          </Field>
          <Field label="Diet" htmlFor="diet" optional>
            <Textarea
              id="diet"
              name="diet"
              rows={2}
              defaultValue={v("diet")}
              placeholder="Low sugar. Soft foods. Loves tea."
            />
          </Field>
          <Field label="Communication" htmlFor="communication" optional>
            <Textarea
              id="communication"
              name="communication"
              rows={2}
              defaultValue={v("communication")}
              placeholder="Hard of hearing on the left. Speak slowly."
            />
          </Field>
          <Field label="Routines and preferences" htmlFor="routines" optional>
            <Textarea
              id="routines"
              name="routines"
              rows={2}
              defaultValue={v("routines")}
              placeholder="Up at 7, nap after lunch, crossword with breakfast."
            />
          </Field>
        </div>
      </section>

      <section className={section}>
        <h2 className="font-semibold">Contacts</h2>
        <RowList
          title="Emergency contacts"
          prefix="contact"
          bKey="Relation"
          bLabel="Relationship"
          addLabel="Add contact"
          initial={initial.emergencyContacts.map((c) => ({
            name: c.name,
            b: c.relation,
            phone: c.phone,
          }))}
        />
        <RowList
          title="Care team"
          prefix="provider"
          bKey="Specialty"
          bLabel="Role or specialty"
          addLabel="Add doctor or provider"
          initial={initial.providers.map((p) => ({ name: p.name, b: p.specialty, phone: p.phone }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pharmacy" htmlFor="pharmacy" optional>
            <Input
              id="pharmacy"
              name="pharmacy"
              defaultValue={v("pharmacy")}
              placeholder="Walgreens on Main St, (555) 010-2299"
            />
          </Field>
          <Field label="Insurance" htmlFor="insurance" optional>
            <Input
              id="insurance"
              name="insurance"
              defaultValue={v("insurance")}
              placeholder="Medicare + AARP supplement, member #…"
            />
          </Field>
        </div>
      </section>

      <div className="sticky bottom-20 z-10 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-pop backdrop-blur lg:bottom-4">
        <p className="text-xs text-muted">Encrypted before it’s saved.</p>
        <SubmitButton size="lg" pendingText="Saving…">
          Save profile
        </SubmitButton>
      </div>
    </form>
  );
}
