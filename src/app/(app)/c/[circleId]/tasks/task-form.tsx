"use client";

import { useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { SubmitButton, useToastAction } from "@/components/ui/client";
import { Input, Select } from "@/components/ui/form-controls";
import { addTask } from "./actions";

export function TaskForm({
  circleId,
  members,
}: {
  circleId: string;
  members: { userId: string; name: string }[];
}) {
  const [state, action] = useToastAction(addTask, { success: false });
  const formRef = useRef<HTMLFormElement>(null);
  const seen = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (state.at === seen.current) return;
    seen.current = state.at;
    if (state.status === "success") formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2 sm:flex-row" noValidate>
      <input type="hidden" name="circleId" value={circleId} />
      <Input
        name="title"
        required
        defaultValue={state.status === "error" ? state.values?.title : undefined}
        placeholder="Pick up prescription, call insurance, buy compression socks…"
        aria-label="New task"
        className="flex-1"
        aria-invalid={!!state.fieldErrors?.title}
      />
      <div className="flex gap-2">
        <Input name="dueDate" type="date" aria-label="Due date" className="w-auto" />
        <Select name="assigneeId" aria-label="Assign to" className="w-36">
          <option value="">Anyone</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name.split(" ")[0]}
            </option>
          ))}
        </Select>
        <SubmitButton aria-label="Add task">
          <Plus aria-hidden />
          <span className="hidden sm:inline">Add</span>
        </SubmitButton>
      </div>
    </form>
  );
}
