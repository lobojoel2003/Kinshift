import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  ClipboardCheck,
  HeartPulse,
  IdCard,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { Card } from "@/components/ui/card";
import { PageHeader, SectionTitle } from "@/components/ui/misc";
import { requireCircle, userCircles } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "More" };

export default async function MorePage(props: PageProps<"/c/[circleId]/more">) {
  const { circleId } = await props.params;
  const ctx = await requireCircle(circleId);
  const base = `/c/${circleId}`;
  const circles = userCircles(ctx.user.id).filter((c) => c.id !== circleId);
  const items = [
    { href: `${base}/tasks`, label: "Tasks", icon: ClipboardCheck },
    { href: `${base}/appointments`, label: "Appointments", icon: CalendarDays },
    { href: `${base}/profile`, label: "Care profile", icon: HeartPulse },
    { href: `${base}/profile/card`, label: "Emergency card", icon: IdCard },
    { href: `${base}/family`, label: "Family & invites", icon: UsersRound },
    ...(ctx.canAdmin
      ? [{ href: `${base}/settings`, label: "Circle settings", icon: Settings }]
      : []),
  ];
  const row = "flex items-center gap-3 px-4 py-3.5 text-[0.95rem] hover:bg-subtle";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title="More" />
      <section>
        <SectionTitle>{ctx.circle.name}</SectionTitle>
        <Card className="divide-y divide-line overflow-hidden">
          {items.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={row}>
              <Icon className="size-5 text-brand" aria-hidden />
              <span className="flex-1">{label}</span>
              <ChevronRight className="size-4 text-faint" aria-hidden />
            </Link>
          ))}
        </Card>
      </section>
      <section>
        <SectionTitle>You</SectionTitle>
        <Card className="divide-y divide-line overflow-hidden">
          <Link href="/settings" className={row}>
            <CircleUserRound className="size-5 text-brand" aria-hidden />
            <span className="flex-1">Account & notifications</span>
            <ChevronRight className="size-4 text-faint" aria-hidden />
          </Link>
          {circles.map((c) => (
            <Link key={c.id} href={`/c/${c.id}`} className={row}>
              <ShieldCheck className="size-5 text-muted" aria-hidden />
              <span className="flex-1">Switch to {c.name}</span>
              <ChevronRight className="size-4 text-faint" aria-hidden />
            </Link>
          ))}
          <Link href="/onboarding" className={row}>
            <Plus className="size-5 text-muted" aria-hidden />
            <span className="flex-1">New care circle</span>
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className={`${row} w-full text-left text-red-600 dark:text-red-400`}
            >
              <LogOut className="size-5" aria-hidden />
              Sign out
            </button>
          </form>
        </Card>
      </section>
    </div>
  );
}
