import Link from "next/link";
import { Check, ChevronsUpDown, LogOut, Plus, Settings } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { Avatar } from "@/components/ui/misc";
import { cn } from "@/lib/cn";

type CircleItem = { id: string; name: string; recipientName: string };

/** Uses <details> so the menus work before (and without) JavaScript. */
export function CircleSwitcher({
  current,
  circles,
  className,
}: {
  current: CircleItem;
  circles: CircleItem[];
  className?: string;
}) {
  return (
    <details data-menu className={cn("group relative", className)}>
      <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-subtle [&::-webkit-details-marker]:hidden">
        <Avatar name={current.recipientName} color="rose" size="sm" />
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-semibold">{current.recipientName}</span>
          <span className="block truncate text-xs text-muted">{current.name}</span>
        </span>
        <ChevronsUpDown className="size-4 text-faint" aria-hidden />
      </summary>
      <div className="absolute top-full left-0 z-40 mt-1 w-64 animate-fade-in rounded-xl border border-line bg-surface p-1 shadow-pop">
        <p className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-faint">Your care circles</p>
        {circles.map((c) => (
          <Link
            key={c.id}
            href={`/c/${c.id}`}
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-subtle"
          >
            <span className="min-w-0 flex-1 truncate">{c.name}</span>
            {c.id === current.id && <Check className="size-4 text-brand" aria-hidden />}
          </Link>
        ))}
        <div className="my-1 border-t border-line" />
        <Link
          href="/onboarding"
          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted hover:bg-subtle hover:text-fg"
        >
          <Plus className="size-4" aria-hidden /> New care circle
        </Link>
      </div>
    </details>
  );
}

export function UserMenu({
  name,
  email,
  color,
  align = "right",
}: {
  name: string;
  email: string;
  color: string;
  align?: "left" | "right";
}) {
  return (
    <details data-menu className="group relative">
      <summary
        className="flex cursor-pointer list-none items-center rounded-full [&::-webkit-details-marker]:hidden"
        aria-label="Account menu"
      >
        <Avatar name={name} color={color} />
      </summary>
      <div
        className={cn(
          "absolute z-40 mt-2 w-60 animate-fade-in rounded-xl border border-line bg-surface p-1 shadow-pop",
          align === "right" ? "right-0" : "bottom-full left-0 mb-2",
        )}
      >
        <div className="px-2.5 py-2">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs text-muted">{email}</p>
        </div>
        <div className="my-1 border-t border-line" />
        <Link
          href="/settings"
          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-subtle"
        >
          <Settings className="size-4" aria-hidden /> Account & notifications
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-red-600 hover:bg-subtle dark:text-red-400"
          >
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
