import type { Metadata } from "next";
import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { JournalEntryCard } from "@/components/journal-entry";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState, PageHeader, SectionTitle } from "@/components/ui/misc";
import { requireCircle } from "@/lib/auth/dal";
import { cn } from "@/lib/cn";
import { listJournal } from "@/lib/data";
import type { JournalKind } from "@/lib/db/schema";
import { JOURNAL_KINDS, type JournalView } from "@/lib/domain";
import { formatDateString, localDateOf, todayIn, addDays } from "@/lib/time";
import { Composer } from "./composer";

export const metadata: Metadata = { title: "Journal" };

const isKind = (v: unknown): v is JournalKind => JOURNAL_KINDS.some((k) => k.value === v);

export default async function JournalPage(props: PageProps<"/c/[circleId]/journal">) {
  const { circleId } = await props.params;
  const sp = await props.searchParams;
  const ctx = await requireCircle(circleId);
  const tz = ctx.circle.timezone;
  const filter = isKind(sp.kind) ? sp.kind : undefined;
  const entries = listJournal(ctx, { kind: filter, limit: 100 });
  const now = new Date();
  const today = todayIn(tz, now);
  const byDay = new Map<string, JournalView[]>();
  for (const e of entries) {
    const d = localDateOf(e.createdAt, tz);
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  }
  const dayLabel = (d: string) =>
    d === today ? "Today" : d === addDays(today, -1) ? "Yesterday" : formatDateString(d, "long");
  const base = `/c/${circleId}/journal`;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Care journal"
        description="Handoffs, observations, vitals and incidents. Read the latest before your shift."
      />
      {ctx.canEdit && (
        <Card className="mb-6">
          <CardBody>
            <Composer
              circleId={circleId}
              recipientName={ctx.circle.recipientName}
              initialKind={isKind(sp.compose) ? sp.compose : "handoff"}
            />
          </CardBody>
        </Card>
      )}

      <nav aria-label="Filter entries" className="mb-4 flex flex-wrap gap-1.5">
        {[{ value: undefined, label: "All" }, ...JOURNAL_KINDS].map((k) => (
          <Link
            key={k.label}
            href={k.value ? `${base}?kind=${k.value}` : base}
            aria-current={filter === k.value ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              filter === k.value ? "bg-fg text-canvas" : "bg-subtle text-muted hover:text-fg",
            )}
          >
            {k.label}
          </Link>
        ))}
      </nav>

      {entries.length === 0 ? (
        <EmptyState
          icon={<NotebookPen />}
          title={filter ? "No entries of this type yet" : "The journal is empty"}
        >
          Write a handoff at the end of each visit so the next person knows how{" "}
          {ctx.circle.recipientName} is doing.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {[...byDay].map(([day, list]) => (
            <section key={day}>
              <SectionTitle>{dayLabel(day)}</SectionTitle>
              <Card>
                <CardBody className="space-y-5">
                  {list.map((e) => (
                    <JournalEntryCard key={e.id} entry={e} ctx={ctx} now={now} />
                  ))}
                </CardBody>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
