import type { Metadata } from "next";
import Link from "next/link";
import { HeartHandshake } from "lucide-react";
import { Logo } from "@/components/logo";
import { ActionButton } from "@/components/ui/client";
import { Alert, Badge } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { findValidInvite } from "@/lib/invites";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/roles";
import { SignupForm } from "../../(auth)/auth-forms";
import { joinCircle } from "./actions";

export const metadata: Metadata = { title: "You're invited" };

export default async function InvitePage(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;
  const invite = findValidInvite(token);
  const user = await getCurrentUser();

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-8">
      <Link href="/" className="w-fit">
        <Logo />
      </Link>
      <div className="flex flex-1 flex-col justify-center py-10">
        {!invite ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">This invite has expired</h1>
            <p className="mt-2 text-muted">
              Invite links work for 7 days and a limited number of people. Ask the person who sent
              it to create a new one from the Family page.
            </p>
            <ButtonLink href="/" variant="outline" className="mt-6 w-fit">
              Go to Kinshift
            </ButtonLink>
          </>
        ) : (
          <>
            <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong">
              <HeartHandshake className="size-6" aria-hidden />
            </span>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-balance">
              {invite.inviterName ? `${invite.inviterName} invited you` : "You’re invited"} to help
              care for {invite.recipientName}
            </h1>
            <p className="mt-2 text-muted">
              Join <strong className="text-fg">{invite.circleName}</strong> to see the medication
              checklist, the care schedule and the family journal.
            </p>
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-subtle p-3 text-sm">
              <Badge tone="brand">{ROLE_LABEL[invite.role]}</Badge>
              <span className="text-muted">{ROLE_DESCRIPTION[invite.role]}</span>
            </div>

            <div className="mt-8">
              {user ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted">
                    Signed in as <strong className="text-fg">{user.email}</strong>.
                  </p>
                  <ActionButton
                    action={joinCircle}
                    fields={{ token }}
                    variant="primary"
                    size="lg"
                    className="w-full"
                  >
                    Join {invite.circleName}
                  </ActionButton>
                </div>
              ) : (
                <>
                  <h2 className="mb-4 font-semibold">Create your account to join</h2>
                  <SignupForm invite={token} />
                  <p className="mt-6 text-center text-sm text-muted">
                    Already use Kinshift?{" "}
                    <Link
                      href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
                      className="font-medium text-brand underline-offset-2 hover:underline"
                    >
                      Sign in to join
                    </Link>
                  </p>
                </>
              )}
            </div>
            <Alert tone="info" className="mt-8">
              Only accept invites from people you know. Members of a care circle can see its
              medication, schedule and journal.
            </Alert>
          </>
        )}
      </div>
    </div>
  );
}
