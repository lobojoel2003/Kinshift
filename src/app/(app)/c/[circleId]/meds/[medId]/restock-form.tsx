"use client";

import { useRef, useEffect } from "react";
import { SubmitButton, useToastAction } from "@/components/ui/client";
import { Input, Select } from "@/components/ui/form-controls";
import { restockMedication } from "../actions";

export function RestockForm({
  circleId,
  medicationId,
  tracked,
}: {
  circleId: string;
  medicationId: string;
  tracked: boolean;
}) {
  const [state, action] = useToastAction(restockMedication);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="circleId" value={circleId} />
      <input type="hidden" name="medicationId" value={medicationId} />
      {tracked ? (
        <Select name="mode" aria-label="Update type" className="w-auto" defaultValue="add">
          <option value="add">Picked up a refill of</option>
          <option value="set">Count on hand is</option>
        </Select>
      ) : (
        <input type="hidden" name="mode" value="set" />
      )}
      <Input
        name="count"
        type="number"
        inputMode="numeric"
        min="0"
        max="5000"
        required
        aria-label="Number of units"
        placeholder="30"
        className="w-24"
      />
      <SubmitButton variant="outline">{tracked ? "Update" : "Start tracking"}</SubmitButton>
    </form>
  );
}
