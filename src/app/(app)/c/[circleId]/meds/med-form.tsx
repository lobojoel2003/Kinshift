"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubmitButton, useToastAction } from "@/components/ui/client";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { cn } from "@/lib/cn";
import { COLOR_CLASSES, COLOR_NAMES } from "@/lib/colors";
import { saveMedication } from "./actions";

export type MedFormValues = {
  id?: string;
  name: string;
  dosage: string;
  purpose: string;
  instructions: string;
  prescriber: string;
  scheduleType: "scheduled" | "prn";
  times: string[];
  days: number[];
  startDate: string;
  endDate: string;
  minIntervalHours: string;
  maxPerDay: string;
  doseQuantity: string;
  stockCount: string;
  stockAlertAt: string;
  color: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PRESETS = [
  { label: "Once a day", times: ["08:00"] },
  { label: "Twice a day", times: ["08:00", "20:00"] },
  { label: "Three times", times: ["08:00", "14:00", "20:00"] },
  { label: "Bedtime", times: ["21:00"] },
];

export function MedForm({ circleId, initial }: { circleId: string; initial: MedFormValues }) {
  const [state, action] = useToastAction(saveMedication);
  const [type, setType] = useState(initial.scheduleType);
  const [times, setTimes] = useState<string[]>(initial.times.length ? initial.times : ["08:00"]);
  const [days, setDays] = useState<number[]>(
    initial.days.length ? initial.days : [0, 1, 2, 3, 4, 5, 6],
  );
  const [color, setColor] = useState(initial.color);
  const fe = state.fieldErrors ?? {};
  const v = (k: keyof MedFormValues) =>
    (state.values?.[k] as string | undefined) ?? (initial[k] as string);

  return (
    <form action={action} className="space-y-8" noValidate>
      <input type="hidden" name="circleId" value={circleId} />
      {initial.id && <input type="hidden" name="medicationId" value={initial.id} />}

      <section className="space-y-4">
        <h2 className="font-semibold">Medication</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" error={fe.name}>
            <Input
              id="name"
              name="name"
              required
              defaultValue={v("name")}
              placeholder="Metformin"
              aria-invalid={!!fe.name}
              autoFocus={!initial.id}
            />
          </Field>
          <Field
            label="Dose"
            htmlFor="dosage"
            optional
            error={fe.dosage}
            hint="Strength and amount, like “500 mg, 1 tablet”."
          >
            <Input id="dosage" name="dosage" defaultValue={v("dosage")} placeholder="500 mg" />
          </Field>
        </div>
        <Field label="Instructions" htmlFor="instructions" optional error={fe.instructions}>
          <Textarea
            id="instructions"
            name="instructions"
            rows={2}
            defaultValue={v("instructions")}
            placeholder="Take with food. Crush and mix with applesauce."
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="What it’s for" htmlFor="purpose" optional error={fe.purpose}>
            <Input
              id="purpose"
              name="purpose"
              defaultValue={v("purpose")}
              placeholder="Blood sugar"
            />
          </Field>
          <Field label="Prescribed by" htmlFor="prescriber" optional error={fe.prescriber}>
            <Input
              id="prescriber"
              name="prescriber"
              defaultValue={v("prescriber")}
              placeholder="Dr. Patel"
            />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Colour</legend>
          <div className="flex flex-wrap gap-2">
            {COLOR_NAMES.map((c) => (
              <label key={c} className="cursor-pointer">
                <input
                  type="radio"
                  name="color"
                  value={c}
                  checked={color === c}
                  onChange={() => setColor(c)}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    "block size-8 rounded-full ring-offset-2 ring-offset-surface peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                    COLOR_CLASSES[c].dot,
                    color === c && "ring-2 ring-fg",
                  )}
                  title={c}
                />
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">Schedule</h2>
        <div
          className="inline-flex rounded-xl bg-subtle p-1"
          role="radiogroup"
          aria-label="Schedule type"
        >
          {(
            [
              ["scheduled", "At set times"],
              ["prn", "As needed"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={cn(
                "cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                type === value ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
              )}
            >
              <input
                type="radio"
                name="scheduleType"
                value={value}
                checked={type === value}
                onChange={() => setType(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>

        {type === "scheduled" ? (
          <>
            <div>
              <p className="mb-2 text-sm font-medium">Times</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <Button
                    key={p.label}
                    variant="outline"
                    size="sm"
                    onClick={() => setTimes(p.times)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {times.map((t, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <Input
                      type="time"
                      name="times"
                      aria-label={`Dose time ${i + 1}`}
                      value={t}
                      onChange={(e) =>
                        setTimes(times.map((x, j) => (j === i ? e.target.value : x)))
                      }
                      className="w-36"
                    />
                    {times.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove time ${i + 1}`}
                        onClick={() => setTimes(times.filter((_, j) => j !== i))}
                      >
                        <Minus />
                      </Button>
                    )}
                  </div>
                ))}
                {times.length < 12 && (
                  <Button variant="soft" size="sm" onClick={() => setTimes([...times, ""])}>
                    <Plus /> Add time
                  </Button>
                )}
              </div>
              {fe.times && (
                <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{fe.times}</p>
              )}
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Days</legend>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d, i) => {
                  const on = days.includes(i);
                  return (
                    <label
                      key={d}
                      className={cn(
                        "flex h-10 w-12 cursor-pointer items-center justify-center rounded-xl border text-sm font-medium transition-colors",
                        on
                          ? "border-brand bg-brand-soft text-brand-strong"
                          : "border-line-strong text-muted hover:bg-subtle",
                      )}
                    >
                      <input
                        type="checkbox"
                        name="days"
                        value={i}
                        checked={on}
                        onChange={() => {
                          if (on && days.length === 1) return;
                          setDays(on ? days.filter((x) => x !== i) : [...days, i]);
                        }}
                        className="sr-only"
                      />
                      {d}
                    </label>
                  );
                })}
              </div>
              <p className="mt-1.5 text-sm text-muted">
                {days.length === 7 || days.length === 0
                  ? "Every day"
                  : `${days.length} days a week`}
              </p>
            </fieldset>
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Minimum hours between doses"
              htmlFor="minIntervalHours"
              optional
              error={fe.minIntervalHours}
              hint="Kinshift warns before an early dose."
            >
              <Input
                id="minIntervalHours"
                name="minIntervalHours"
                type="number"
                inputMode="decimal"
                min="0.25"
                step="0.25"
                defaultValue={v("minIntervalHours")}
                placeholder="6"
              />
            </Field>
            <Field
              label="Maximum doses in 24 hours"
              htmlFor="maxPerDay"
              optional
              error={fe.maxPerDay}
            >
              <Input
                id="maxPerDay"
                name="maxPerDay"
                type="number"
                inputMode="numeric"
                min="1"
                max="24"
                defaultValue={v("maxPerDay")}
                placeholder="4"
              />
            </Field>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date" htmlFor="startDate" error={fe.startDate}>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              required
              defaultValue={v("startDate")}
            />
          </Field>
          <Field
            label="End date"
            htmlFor="endDate"
            optional
            error={fe.endDate}
            hint="For a short course, like antibiotics."
          >
            <Input id="endDate" name="endDate" type="date" defaultValue={v("endDate")} />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-semibold">Supply</h2>
          <p className="text-sm text-muted">
            Optional. Kinshift counts down with each dose and warns when it’s time to refill.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="On hand now" htmlFor="stockCount" optional error={fe.stockCount}>
            <Input
              id="stockCount"
              name="stockCount"
              type="number"
              inputMode="numeric"
              min="0"
              defaultValue={v("stockCount")}
              placeholder="60"
            />
          </Field>
          <Field label="Units per dose" htmlFor="doseQuantity" error={fe.doseQuantity}>
            <Input
              id="doseQuantity"
              name="doseQuantity"
              type="number"
              inputMode="numeric"
              min="1"
              max="20"
              defaultValue={v("doseQuantity") || "1"}
            />
          </Field>
          <Field
            label="Warn when down to"
            htmlFor="stockAlertAt"
            optional
            error={fe.stockAlertAt}
            hint="Defaults to a week’s supply."
          >
            <Input
              id="stockAlertAt"
              name="stockAlertAt"
              type="number"
              inputMode="numeric"
              min="0"
              defaultValue={v("stockAlertAt")}
            />
          </Field>
        </div>
      </section>

      <div className="sticky bottom-20 z-10 flex justify-end gap-2 rounded-2xl border border-line bg-surface/95 p-3 shadow-pop backdrop-blur lg:bottom-4">
        <SubmitButton size="lg" pendingText="Saving…">
          {initial.id ? "Save changes" : "Add medication"}
        </SubmitButton>
      </div>
    </form>
  );
}
