"use server";

import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { circleAction, str } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import { getDb } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import {
  errorState,
  invalid,
  optionalDate,
  requiredText,
  successState,
  type FormState,
} from "@/lib/forms";
import { newId } from "@/lib/id";
import { notifyCircle } from "@/lib/notify";
import { canEdit } from "@/lib/roles";
import { formatDateString } from "@/lib/time";

const schema = z.object({
  title: requiredText(200, "Task"),
  dueDate: optionalDate,
  assigneeId: z.string().max(64).default(""),
});

export async function addTask(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "edit", (ctx) => {
    const parsed = schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error, formData);
    const d = parsed.data;
    const assignee = d.assigneeId ? ctx.memberById.get(d.assigneeId) : undefined;
    if (d.assigneeId && (!assignee || !canEdit(assignee.role)))
      return errorState("Pick someone from this circle.");
    getDb()
      .insert(tasks)
      .values({
        id: newId(),
        circleId: ctx.circle.id,
        titleEnc: ctx.cipher.enc("task.title", d.title),
        dueDate: d.dueDate ?? null,
        assigneeId: assignee?.userId ?? null,
        createdBy: ctx.user.id,
        createdAt: new Date(),
      })
      .run();
    logActivity({ circleId: ctx.circle.id, cipher: ctx.cipher }, ctx.user.id, "task.added", {
      title: d.title,
    });
    if (assignee && assignee.userId !== ctx.user.id) {
      const circleId = ctx.circle.id;
      const me = ctx.user.name;
      after(() =>
        notifyCircle(
          circleId,
          {
            kind: "shifts",
            title: "New task for you",
            body: `${me}: ${d.title}${d.dueDate ? ` (by ${formatDateString(d.dueDate, "medium")})` : ""}`,
            discreetTitle: "New task for you",
            discreetBody: `${me} assigned you a task.`,
            url: `/c/${circleId}/tasks`,
          },
          { to: [assignee.userId] },
        ),
      );
    }
    return successState("Task added.", { values: {} });
  });
}

export async function toggleTask(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "edit", (ctx) => {
    const db = getDb();
    const task = db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, str(formData, "taskId")), eq(tasks.circleId, ctx.circle.id)))
      .get();
    if (!task) return errorState("That task was deleted.");
    const done = !task.doneAt;
    db.update(tasks)
      .set({ doneAt: done ? new Date() : null, doneBy: done ? ctx.user.id : null })
      .where(eq(tasks.id, task.id))
      .run();
    const title = ctx.cipher.dec("task.title", task.titleEnc);
    logActivity(
      { circleId: ctx.circle.id, cipher: ctx.cipher },
      ctx.user.id,
      done ? "task.done" : "task.reopened",
      { title },
    );
    return successState(done ? "Nice work. Task done." : "Task reopened.");
  });
}

export async function deleteTask(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "edit", (ctx) => {
    const db = getDb();
    const task = db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, str(formData, "taskId")), eq(tasks.circleId, ctx.circle.id)))
      .get();
    if (!task) return errorState("That task was already deleted.");
    if (!ctx.canAdmin && task.createdBy !== ctx.user.id) {
      return errorState("Only an organizer or the person who added it can delete this task.");
    }
    db.delete(tasks).where(eq(tasks.id, task.id)).run();
    return successState("Task deleted.");
  });
}
