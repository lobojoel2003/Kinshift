import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { requireUser, userCircles } from "@/lib/auth/dal";
import { timeZoneOptions } from "@/lib/time";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up a care circle" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const existing = userCircles(user.id);
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 py-8">
      <div className="flex items-center justify-between">
        <Logo />
        {existing.length > 0 && (
          <Link href={`/c/${existing[0].id}`} className="text-sm text-muted hover:text-fg">
            Back to {existing[0].recipientName}
          </Link>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-center py-10">
        <p className="text-sm font-medium text-brand">
          {existing.length > 0 ? "New care circle" : `Welcome, ${user.name.split(" ")[0]}`}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Let’s set up your care circle
        </h1>
        <p className="mt-2 mb-8 text-muted">
          A care circle is the person you’re looking after plus everyone who helps. You can invite
          family as soon as it’s created.
        </p>
        <OnboardingForm timeZones={timeZoneOptions()} />
      </div>
    </div>
  );
}
