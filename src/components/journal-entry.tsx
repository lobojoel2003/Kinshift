import { Activity, ArrowRightLeft, NotebookText, Siren } from "lucide-react";
import { deleteJournalEntry } from "@/app/(app)/c/[circleId]/journal/actions";
import { ActionButton } from "@/components/ui/client";
import { Avatar, Badge } from "@/components/ui/misc";
import type { CircleContext } from "@/lib/auth/dal";
import { cn } from "@/lib/cn";
import type { JournalKind } from "@/lib/db/schema";
import { MOODS, type JournalView, type Vitals } from "@/lib/domain";
import { HOUR, formatDateTime, formatRelative } from "@/lib/time";

const kindMeta: Record<
  JournalKind,
  { label: string; icon: typeof Activity; tone: "brand" | "info" | "danger" | "neutral" }
> = {
  handoff: { label: "Handoff", icon: ArrowRightLeft, tone: "brand" },
  note: { label: "Note", icon: NotebookText, tone: "neutral" },
  vitals: { label: "Vitals", icon: Activity, tone: "info" },
  incident: { label: "Incident", icon: Siren, tone: "danger" },
};

export function vitalsChips(v: Vitals): string[] {
  const out: string[] = [];
  if (v.bpSystolic && v.bpDiastolic) out.push(`BP ${v.bpSystolic}/${v.bpDiastolic}`);
  if (v.pulse) out.push(`Pulse ${v.pulse}`);
  if (v.temperature) out.push(`Temp ${v.temperature}°${v.temperatureUnit ?? "F"}`);
  if (v.oxygen) out.push(`SpO₂ ${v.oxygen}%`);
  if (v.glucose) out.push(`Glucose ${v.glucose}`);
  if (v.weight) out.push(`Weight ${v.weight} ${v.weightUnit ?? "lb"}`);
  return out;
}

export function JournalEntryCard({
  entry,
  ctx,
  now,
  compact = false,
}: {
  entry: JournalView;
  ctx: CircleContext;
  now: Date;
  compact?: boolean;
}) {
  const author = entry.authorId ? ctx.memberById.get(entry.authorId) : undefined;
  const meta = kindMeta[entry.kind];
  const Icon = meta.icon;
  const mood = MOODS.find((m) => m.value === entry.mood);
  const canDelete =
    ctx.canEdit &&
    (entry.authorId === ctx.user.id
      ? now.getTime() - entry.createdAt.getTime() < 24 * HOUR
      : ctx.canAdmin);
  return (
    <article
      className={cn(
        "flex gap-3",
        entry.kind === "incident" && !compact && "rounded-xl bg-red-50/60 p-3 dark:bg-red-950/20",
      )}
      data-testid="journal-entry"
    >
      <Avatar name={author?.name ?? "Former member"} color={author?.color} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold">{author?.name ?? "Former member"}</span>
          <Badge tone={meta.tone}>
            <Icon aria-hidden /> {meta.label}
          </Badge>
          {mood && <Badge tone="neutral">Mood: {mood.label}</Badge>}
          <time
            className="text-xs text-faint"
            dateTime={entry.createdAt.toISOString()}
            title={formatDateTime(entry.createdAt, ctx.circle.timezone, ctx.user.hour12)}
          >
            {formatRelative(entry.createdAt, now)}
          </time>
        </div>
        {entry.body && (
          <p className={cn("mt-1 text-[0.95rem] whitespace-pre-wrap", compact && "line-clamp-4")}>
            {entry.body}
          </p>
        )}
        {entry.vitals && vitalsChips(entry.vitals).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {vitalsChips(entry.vitals).map((c) => (
              <span
                key={c}
                className="tabular rounded-lg bg-sky-50 px-2 py-1 text-xs font-medium text-sky-900 dark:bg-sky-950/60 dark:text-sky-200"
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>
      {!compact && canDelete && (
        <ActionButton
          action={deleteJournalEntry}
          fields={{ circleId: ctx.circle.id, entryId: entry.id }}
          variant="ghost"
          size="sm"
          className="self-start text-faint"
          confirm={{
            title: "Delete this entry?",
            body: "It will be removed for everyone.",
            confirmLabel: "Delete",
            danger: true,
          }}
        >
          Delete
        </ActionButton>
      )}
    </article>
  );
}
