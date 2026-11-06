import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { CircleSwitcher, UserMenu } from "@/components/menus";
import { BottomNav, MenuCloser, SidebarNav } from "@/components/nav";
import { AutoRefresh } from "@/components/ui/client";
import { SectionTitle } from "@/components/ui/misc";
import { requireCircle, userCircles } from "@/lib/auth/dal";
import { dosesForDate } from "@/lib/data";
import { todayIn } from "@/lib/time";

export async function generateMetadata(props: LayoutProps<"/c/[circleId]">): Promise<Metadata> {
  const { circleId } = await props.params;
  const ctx = await requireCircle(circleId);
  return {
    title: { default: ctx.circle.recipientName, template: `%s · ${ctx.circle.recipientName}` },
  };
}

export default async function CircleLayout(props: LayoutProps<"/c/[circleId]">) {
  const { circleId } = await props.params;
  const ctx = await requireCircle(circleId);
  const { circle, user } = ctx;
  const base = `/c/${circle.id}`;
  const now = new Date();
  const missed = dosesForDate(ctx, todayIn(circle.timezone, now), now).filter(
    (d) => d.state === "missed",
  ).length;
  const me = ctx.memberById.get(user.id);
  const circles = userCircles(user.id);

  const primary = [
    { key: "today" as const, label: "Today", href: base },
    { key: "meds" as const, label: "Meds", href: `${base}/meds`, badge: missed },
    { key: "schedule" as const, label: "Schedule", href: `${base}/schedule` },
    { key: "journal" as const, label: "Journal", href: `${base}/journal` },
  ];
  const secondary = [
    { key: "tasks" as const, label: "Tasks", href: `${base}/tasks` },
    { key: "profile" as const, label: "Care profile", href: `${base}/profile` },
    { key: "family" as const, label: "Family", href: `${base}/family` },
    ...(ctx.canAdmin
      ? [{ key: "settings" as const, label: "Circle settings", href: `${base}/settings` }]
      : []),
  ];

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface px-3 py-4 lg:flex">
        <Link href={base} className="mb-4 flex items-center gap-2 px-2">
          <LogoMark className="size-7" />
          <span className="text-[1.05rem] font-semibold tracking-tight">Kinshift</span>
        </Link>
        <CircleSwitcher current={circle} circles={circles} className="mb-4" />
        <nav aria-label="Sidebar" className="flex flex-1 flex-col gap-5 overflow-y-auto">
          <SidebarNav base={base} items={primary} />
          <div>
            <SectionTitle className="px-3">Circle</SectionTitle>
            <SidebarNav base={base} items={secondary} />
          </div>
        </nav>
        <div className="mt-4 flex items-center gap-3 border-t border-line px-1 pt-4">
          <UserMenu name={user.name} email={user.email} color={me?.color ?? "teal"} align="left" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <Link href="/settings" className="text-xs text-muted hover:text-fg">
              Account & notifications
            </Link>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="no-print pt-safe sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-canvas/90 px-3 backdrop-blur-md lg:hidden">
          <div className="flex h-14 flex-1 items-center gap-2">
            <CircleSwitcher current={circle} circles={circles} className="min-w-0 flex-1" />
            <UserMenu name={user.name} email={user.email} color={me?.color ?? "teal"} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pt-8 lg:pb-12">
          {props.children}
        </main>
      </div>

      <BottomNav
        base={base}
        items={[...primary, { key: "more", label: "More", href: `${base}/more` }]}
      />
      <MenuCloser />
      <AutoRefresh />
    </div>
  );
}
