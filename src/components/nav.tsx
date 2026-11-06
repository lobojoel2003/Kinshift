"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CircleUserRound,
  ClipboardCheck,
  HeartPulse,
  House,
  LayoutGrid,
  NotebookPen,
  Pill,
  Settings,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/cn";

const icons = {
  today: House,
  meds: Pill,
  schedule: CalendarDays,
  journal: NotebookPen,
  tasks: ClipboardCheck,
  profile: HeartPulse,
  family: UsersRound,
  settings: Settings,
  more: LayoutGrid,
  account: CircleUserRound,
};

export type NavKey = keyof typeof icons;
type Item = { key: NavKey; label: string; href: string; badge?: number };

function useActive(base: string) {
  const pathname = usePathname();
  return (key: NavKey, href: string) => {
    if (key === "today") return pathname === base;
    if (key === "schedule") {
      return pathname.startsWith(`${base}/schedule`) || pathname.startsWith(`${base}/appointments`);
    }
    if (key === "more") {
      return ["tasks", "profile", "family", "settings", "more"].some((s) =>
        pathname.startsWith(`${base}/${s}`),
      );
    }
    if (key === "account") return pathname.startsWith("/settings");
    return pathname.startsWith(href);
  };
}

export function SidebarNav({ base, items }: { base: string; items: Item[] }) {
  const isActive = useActive(base);
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const Icon = icons[item.key];
        const active = isActive(item.key, item.href);
        return (
          <li key={item.key}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-[0.94rem] font-medium transition-colors",
                active
                  ? "bg-brand-soft text-brand-strong"
                  : "text-muted hover:bg-subtle hover:text-fg",
              )}
            >
              <Icon className="size-[1.15rem]" aria-hidden />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="tabular rounded-full bg-red-600 px-1.5 text-xs leading-5 font-semibold text-white">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function BottomNav({ base, items }: { base: string; items: Item[] }) {
  const isActive = useActive(base);
  return (
    <nav
      aria-label="Main"
      className="no-print pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map((item) => {
          const Icon = icons[item.key];
          const active = isActive(item.key, item.href);
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[0.7rem] font-medium transition-colors",
                  active ? "text-brand" : "text-faint hover:text-fg",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-brand-soft",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                {item.label}
                {item.badge ? (
                  <span className="absolute top-1 left-1/2 ml-2 min-w-4 rounded-full bg-red-600 px-1 text-center text-[0.62rem] leading-4 font-semibold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Closes open <details data-menu> dropdowns on navigation, outside clicks and Escape. */
export function MenuCloser() {
  const pathname = usePathname();
  useEffect(() => {
    document.querySelectorAll<HTMLDetailsElement>("details[data-menu][open]").forEach((d) => {
      d.open = false;
    });
  }, [pathname]);
  useEffect(() => {
    const closeAll = (except?: Element | null) =>
      document.querySelectorAll<HTMLDetailsElement>("details[data-menu][open]").forEach((d) => {
        if (d !== except) d.open = false;
      });
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const inside = target?.closest("details[data-menu]");
      closeAll(inside);
      if (inside && target?.closest("a")) (inside as HTMLDetailsElement).open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  return null;
}
