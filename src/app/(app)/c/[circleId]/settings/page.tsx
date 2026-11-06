import type { Metadata } from "next";
import { Download, KeyRound } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireCircle } from "@/lib/auth/dal";
import { timeZoneOptions } from "@/lib/time";
import { CircleSettingsForm, DeleteCircleForm } from "./settings-forms";

export const metadata: Metadata = { title: "Circle settings" };

export default async function CircleSettingsPage(props: PageProps<"/c/[circleId]/settings">) {
  const { circleId } = await props.params;
  const ctx = await requireCircle(circleId, "admin");
  const c = ctx.circle;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Circle settings" description="Only organizers can see this page." />
      <Card>
        <CardHeader title="General" />
        <CardBody>
          <CircleSettingsForm
            circle={{
              id: c.id,
              name: c.name,
              recipientName: c.recipientName,
              timezone: c.timezone,
              coverageStart: c.coverageStart,
              coverageEnd: c.coverageEnd,
              missedDoseGraceMinutes: c.missedDoseGraceMinutes,
            }}
            timeZones={timeZoneOptions()}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Your data"
          icon={<KeyRound />}
          description="Health details in this circle are encrypted at rest with a key unique to this circle."
        />
        <CardBody className="space-y-3">
          <p className="text-sm text-muted">
            Download everything in this circle (medications, dose history, schedule, appointments,
            journal, tasks and profile) as a readable JSON file. Store it somewhere safe: the export
            is not encrypted.
          </p>
          <a
            href={`/c/${circleId}/export`}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 text-sm font-medium shadow-sm hover:bg-subtle"
          >
            <Download className="size-4" aria-hidden /> Export data (JSON)
          </a>
        </CardBody>
      </Card>

      <Card className="border-red-200 dark:border-red-900">
        <CardHeader
          title="Delete this circle"
          description="This permanently deletes every medication, log, shift, appointment and journal entry. It cannot be undone."
        />
        <CardBody>
          <DeleteCircleForm circleId={circleId} name={c.name} />
        </CardBody>
      </Card>
    </div>
  );
}
