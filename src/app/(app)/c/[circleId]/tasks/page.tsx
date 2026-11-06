import type { Metadata } from "next";
import { Check, ClipboardCheck, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/ui/client";
import { Card, CardBody } from "@/components/ui/card";
import { Avatar, Badge, EmptyState, PageHeader, SectionTitle } from "@/components/ui/misc";
import { requireCircle, type CircleContext } from "@/lib/auth/dal";
import { cn } from "@/lib/cn";
import { listTasks } from "@/lib/data";
import type { TaskView } from "@/lib/domain";
import { canEdit } from "@/lib/roles";
import { DAY, formatDateString, formatRelative, todayIn } from "@/lib/time";
import { deleteTask, toggleTask } from "./actions";
import { TaskForm } from "./task-form";

export const metadata: Metadata = { title: "Tasks" };

function TaskRow({
  task,
  ctx,
  today,
  now,
}: {
  task: TaskView;
  ctx: CircleContext;
  today: string;
  now: Date;
}) {
  const assignee = task.assigneeId ? ctx.memberById.get(task.assigneeId) : undefined;
  const doneBy = task.doneBy ? ctx.memberById.get(task.doneBy) : undefined;
  const overdue = !task.doneAt && task.dueDate && task.dueDate < today;
  return (
    <li className="flex items-center gap-3 py-2.5" data-testid="task-row">
      {ctx.canEdit ? (
        <ActionButton
          action={toggleTask}
          fields={{ circleId: ctx.circle.id, taskId: task.id }}
          variant="ghost"
          size="icon-sm"
          title={task.doneAt ? `Reopen “${task.title}”` : `Mark “${task.title}” as done`}
          className={cn(
            "rounded-full border-2",
            task.doneAt
              ? "border-brand bg-brand text-brand-fg hover:bg-brand-strong"
              : "border-line-strong text-transparent hover:text-faint",
          )}
        >
          <Check aria-hidden />
        </ActionButton>
      ) : (
        <span
          className={cn(
            "size-5 rounded-full border-2",
            task.doneAt ? "border-brand bg-brand" : "border-line-strong",
          )}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("text-[0.95rem]", task.doneAt && "text-muted line-through")}>
          {task.title}
        </p>
        <p className="text-xs text-muted">
          {task.doneAt
            ? `Done ${formatRelative(task.doneAt, now)}${doneBy ? ` by ${doneBy.name.split(" ")[0]}` : ""}`
            : assignee
              ? `For ${assignee.userId === ctx.user.id ? "you" : assignee.name.split(" ")[0]}`
              : "Anyone can do this"}
        </p>
      </div>
      {task.dueDate && !task.doneAt && (
        <Badge tone={overdue ? "danger" : task.dueDate === today ? "warning" : "neutral"}>
          {overdue ? "Overdue · " : ""}
          {task.dueDate === today ? "Today" : formatDateString(task.dueDate, "short")}
        </Badge>
      )}
      {assignee && !task.doneAt && <Avatar name={assignee.name} color={assignee.color} size="xs" />}
      {(ctx.canAdmin || task.createdBy === ctx.user.id) && ctx.canEdit && (
        <ActionButton
          action={deleteTask}
          fields={{ circleId: ctx.circle.id, taskId: task.id }}
          variant="ghost"
          size="icon-sm"
          title="Delete task"
          className="text-faint"
          confirm={{ title: "Delete this task?", confirmLabel: "Delete", danger: true }}
        >
          <Trash2 aria-hidden />
        </ActionButton>
      )}
    </li>
  );
}

export default async function TasksPage(props: PageProps<"/c/[circleId]/tasks">) {
  const { circleId } = await props.params;
  const ctx = await requireCircle(circleId);
  const now = new Date();
  const today = todayIn(ctx.circle.timezone, now);
  const all = listTasks(ctx, { includeDoneSince: new Date(now.getTime() - 14 * DAY) });
  const open = all.filter((t) => !t.doneAt);
  const done = all.filter((t) => t.doneAt);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Tasks"
        description="Errands and to-dos that keep care running: refills, calls, paperwork."
      />
      {ctx.canEdit && (
        <Card className="mb-6">
          <CardBody>
            <TaskForm circleId={circleId} members={ctx.members.filter((m) => canEdit(m.role))} />
          </CardBody>
        </Card>
      )}
      {all.length === 0 ? (
        <EmptyState icon={<ClipboardCheck />} title="No tasks">
          Add errands so they don’t live in someone’s head. Anyone can tick them off.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          <section>
            <SectionTitle>To do · {open.length}</SectionTitle>
            <Card>
              <CardBody className="py-1">
                {open.length === 0 ? (
                  <p className="py-3 text-sm text-muted">All done. Nice work, everyone.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {open.map((t) => (
                      <TaskRow key={t.id} task={t} ctx={ctx} today={today} now={now} />
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </section>
          {done.length > 0 && (
            <section>
              <SectionTitle>Done in the last 2 weeks</SectionTitle>
              <Card>
                <CardBody className="py-1">
                  <ul className="divide-y divide-line">
                    {done.map((t) => (
                      <TaskRow key={t.id} task={t} ctx={ctx} today={today} now={now} />
                    ))}
                  </ul>
                </CardBody>
              </Card>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
