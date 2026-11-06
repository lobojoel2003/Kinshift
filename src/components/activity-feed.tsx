import { Avatar } from "@/components/ui/misc";
import type { ActivityView } from "@/lib/activity";
import type { CircleContext } from "@/lib/auth/dal";
import { formatRelative } from "@/lib/time";

export function ActivityFeed({
  items,
  ctx,
  now,
}: {
  items: ActivityView[];
  ctx: CircleContext;
  now: Date;
}) {
  if (items.length === 0) return <p className="text-sm text-muted">Nothing has happened yet.</p>;
  return (
    <ol className="space-y-3">
      {items.map((a) => {
        const actor = a.actorId ? ctx.memberById.get(a.actorId) : undefined;
        return (
          <li key={a.id} className="flex items-start gap-2.5 text-sm">
            <Avatar name={actor?.name ?? "?"} color={actor?.color} size="xs" className="mt-0.5" />
            <p className="min-w-0 flex-1">
              <span className="font-medium">
                {actor
                  ? actor.userId === ctx.user.id
                    ? "You"
                    : actor.name.split(" ")[0]
                  : "Someone"}
              </span>{" "}
              <span className="text-muted">{a.text}</span>
              <span className="ml-1.5 text-xs text-faint">{formatRelative(a.createdAt, now)}</span>
            </p>
          </li>
        );
      })}
    </ol>
  );
}
