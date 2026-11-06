import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import {
  BellRing,
  ChevronLeft,
  Info,
  LockKeyhole,
  MonitorSmartphone,
  UserRound,
} from "lucide-react";
import { ActionButton } from "@/components/ui/client";
import { Logo } from "@/components/logo";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/misc";
import { requireUser, userCircles } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { appVersion } from "@/lib/env";
import { vapidPublicKey } from "@/lib/push";
import { ROLE_LABEL } from "@/lib/roles";
import { formatRelative } from "@/lib/time";
import { signOutOtherDevices } from "./actions";
import { PushManager } from "./push-manager";
import {
  AccountForm,
  DeleteAccountForm,
  NotificationPrefsForm,
  PasswordForm,
} from "./settings-forms";

export const metadata: Metadata = { title: "Account settings" };

function deviceName(ua: string | null): string {
  if (!ua) return "Unknown device";
  const os = /iPhone|iPad/.test(ua)
    ? "iPhone/iPad"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "Mac"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "Device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  return `${browser} on ${os}`;
}

export default async function SettingsPage() {
  const user = await requireUser();
  const circles = userCircles(user.id);
  const mySessions = getDb()
    .select()
    .from(sessions)
    .where(eq(sessions.userId, user.id))
    .orderBy(desc(sessions.lastSeenAt))
    .all();
  const back = circles[0] ? `/c/${circles[0].id}` : "/onboarding";

  return (
    <div className="mx-auto max-w-3xl px-4 pt-5 pb-16 sm:px-6 lg:pt-10">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={back}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
        >
          <ChevronLeft className="size-4" aria-hidden /> Back
        </Link>
        <Logo />
      </div>
      <PageHeader title="Account settings" description={user.email} />
      <div className="space-y-5">
        <Card>
          <CardHeader title="Profile" icon={<UserRound />} />
          <CardBody>
            <AccountForm name={user.name} email={user.email} hour12={user.hour12} />
          </CardBody>
        </Card>

        <Card id="notifications">
          <CardHeader
            title="Notifications"
            icon={<BellRing />}
            description="Reminders arrive on each device where you turn them on, even when Kinshift is closed."
          />
          <CardBody className="space-y-5">
            <PushManager vapidPublicKey={vapidPublicKey()} />
            <NotificationPrefsForm
              values={{
                notifyDoses: user.notifyDoses,
                notifyMissed: user.notifyMissed,
                notifyShifts: user.notifyShifts,
                notifyAppointments: user.notifyAppointments,
                notifyJournal: user.notifyJournal,
                notifyDiscreet: user.notifyDiscreet,
              }}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Password" icon={<LockKeyhole />} />
          <CardBody>
            <PasswordForm />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Signed-in devices"
            icon={<MonitorSmartphone />}
            action={
              mySessions.length > 1 && (
                <ActionButton action={signOutOtherDevices} fields={{}} variant="outline">
                  Sign out others
                </ActionButton>
              )
            }
          />
          <CardBody>
            <ul className="divide-y divide-line">
              {mySessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>{deviceName(s.userAgent)}</span>
                  {s.id === user.sessionId ? (
                    <Badge tone="success">This device</Badge>
                  ) : (
                    <span className="text-muted">Active {formatRelative(s.lastSeenAt)}</span>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Your care circles" />
          <CardBody>
            <ul className="divide-y divide-line">
              {circles.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link href={`/c/${c.id}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                  <Badge tone={c.role === "owner" ? "brand" : "neutral"}>
                    {ROLE_LABEL[c.role]}
                  </Badge>
                </li>
              ))}
            </ul>
            <Link
              href="/onboarding"
              className="mt-3 inline-block text-sm font-medium text-brand hover:underline"
            >
              + Start another care circle
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="About Kinshift" icon={<Info />} />
          <CardBody>
            <dl className="grid grid-cols-[8rem_1fr] gap-y-1.5 text-sm">
              <dt className="text-muted">Version</dt>
              <dd className="font-medium" data-testid="app-version">
                {appVersion.version}
              </dd>
              <dt className="text-muted">Build</dt>
              <dd className="tabular">{appVersion.build}</dd>
              <dt className="text-muted">Commit</dt>
              <dd className="font-mono text-xs">{appVersion.commit.slice(0, 12)}</dd>
            </dl>
            <p className="mt-3 text-sm text-muted">
              Free and open source under the AGPL-3.0.{" "}
              <a
                href="https://github.com/lobojoel2003/Kinshift"
                className="font-medium text-brand hover:underline"
              >
                Source code and updates
              </a>
              {" · "}
              <Link href="/privacy" className="font-medium text-brand hover:underline">
                Privacy
              </Link>
            </p>
          </CardBody>
        </Card>

        <Card className="border-red-200 dark:border-red-900">
          <CardHeader
            title="Delete account"
            description="Removes your account and every circle where you are the only member. Your entries in shared circles stay, shown as “Former member”."
          />
          <CardBody>
            <DeleteAccountForm />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
