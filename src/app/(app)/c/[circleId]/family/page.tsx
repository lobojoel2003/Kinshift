import type { Metadata } from "next";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { LogOut, UserMinus } from "lucide-react";
import { ActionButton } from "@/components/ui/client";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, Badge, PageHeader } from "@/components/ui/misc";
import { requireCircle } from "@/lib/auth/dal";
import { dutyByAssignee } from "@/lib/coverage";
import { shiftsBetween } from "@/lib/data";
import { getDb } from "@/lib/db";
import { invites } from "@/lib/db/schema";
import { ROLE_LABEL } from "@/lib/roles";
import { DAY, formatDateString, formatHours, formatRelative, localDateOf } from "@/lib/time";
import { leaveCircle, removeMember, revokeInvite } from "./actions";
import { InviteForm, MyDetailsForm, RoleSelect } from "./family-forms";

export const metadata: Metadata = { title: "Family" };

export default async function FamilyPage(props: PageProps<"/c/[circleId]/family">) {
  const { circleId } = await props.params;
  const ctx = await requireCircle(circleId);
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * DAY);
  const hours = dutyByAssignee(shiftsBetween(ctx, monthAgo, now), monthAgo, now);
  const me = ctx.memberById.get(ctx.user.id)!;
  const activeInvites = ctx.canAdmin
    ? getDb()
        .select()
        .from(invites)
        .where(
          and(
            eq(invites.circleId, circleId),
            isNull(invites.revokedAt),
            gt(invites.expiresAt, now),
          ),
        )
        .orderBy(desc(invites.createdAt))
        .all()
        .filter((i) => i.uses < i.maxUses)
    : [];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Family"
        description={`Everyone helping care for ${ctx.circle.recipientName}.`}
      />

      <Card>
        <CardHeader
          title={`Members · ${ctx.members.length}`}
          description="Hours are shifts covered in the last 30 days."
        />
        <CardBody>
          <ul className="divide-y divide-line">
            {ctx.members.map((m) => (
              <li
                key={m.userId}
                className="flex flex-wrap items-center gap-3 py-3"
                data-testid="member-row"
              >
                <Avatar name={m.name} color={m.color} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {m.name}
                    {m.userId === ctx.user.id && (
                      <span className="font-normal text-muted"> (you)</span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted">
                    {[
                      m.relationship,
                      m.email,
                      `joined ${formatDateString(localDateOf(m.joinedAt, ctx.circle.timezone), "short")}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="tabular text-sm text-muted">
                  {formatHours(hours.get(m.userId) ?? 0)}
                </span>
                {ctx.canAdmin && m.userId !== ctx.user.id ? (
                  <div className="flex items-center gap-1">
                    <RoleSelect circleId={circleId} userId={m.userId} role={m.role} />
                    <ActionButton
                      action={removeMember}
                      fields={{ circleId, userId: m.userId }}
                      variant="ghost"
                      size="icon-sm"
                      title={`Remove ${m.name}`}
                      className="text-faint hover:text-red-600"
                      confirm={{
                        title: `Remove ${m.name}?`,
                        body: "They will immediately lose access to everything in this circle. Their past entries stay.",
                        confirmLabel: "Remove",
                        danger: true,
                      }}
                    >
                      <UserMinus aria-hidden />
                    </ActionButton>
                  </div>
                ) : (
                  <Badge tone={m.role === "owner" ? "brand" : "neutral"}>
                    {ROLE_LABEL[m.role]}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {ctx.canAdmin && (
        <Card>
          <CardHeader
            title="Invite family"
            description="Anyone with the link can create an account and join. No app store needed."
          />
          <CardBody>
            <InviteForm
              circleId={circleId}
              circleName={ctx.circle.name}
              recipientName={ctx.circle.recipientName}
            />
            {activeInvites.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-sm font-medium">Active invite links</p>
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {activeInvites.map((i) => (
                    <li
                      key={i.id}
                      className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm"
                    >
                      <Badge tone="neutral">{ROLE_LABEL[i.role]}</Badge>
                      <span className="min-w-0 flex-1 truncate">
                        {i.label || "Invite link"}
                        <span className="text-muted">
                          {" "}
                          · used {i.uses}/{i.maxUses} · expires {formatRelative(i.expiresAt, now)}
                        </span>
                      </span>
                      <ActionButton
                        action={revokeInvite}
                        fields={{ circleId, inviteId: i.id }}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 dark:text-red-400"
                      >
                        Revoke
                      </ActionButton>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Your details in this circle" />
        <CardBody>
          <MyDetailsForm
            circleId={circleId}
            relationship={me.relationship ?? ""}
            color={me.color}
          />
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <ActionButton
          action={leaveCircle}
          fields={{ circleId }}
          variant="ghost"
          className="text-red-600 dark:text-red-400"
          confirm={{
            title: `Leave ${ctx.circle.name}?`,
            body: "You’ll lose access until someone invites you again.",
            confirmLabel: "Leave circle",
            danger: true,
          }}
        >
          <LogOut aria-hidden /> Leave circle
        </ActionButton>
      </div>
    </div>
  );
}
