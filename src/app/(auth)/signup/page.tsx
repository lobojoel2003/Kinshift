import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { userCount } from "@/lib/circles";
import { registrationMode } from "@/lib/env";
import { Alert } from "@/components/ui/misc";
import { SignupForm } from "../auth-forms";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/");
  const firstRun = userCount() === 0;
  const open = firstRun || registrationMode() === "open";
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        {firstRun ? "Set up Kinshift" : "Create your account"}
      </h1>
      <p className="mt-1 mb-6 text-muted">
        {firstRun
          ? "You’re the first person here. Create your account, then invite your family."
          : "It takes about a minute. Then set up a care circle or join one."}
      </p>
      {open ? (
        <SignupForm />
      ) : (
        <Alert tone="info" title="Invite needed">
          This Kinshift server only accepts new accounts through an invite link. Ask someone in your
          family to send you one from the Family page.
        </Alert>
      )}
      {!firstRun && (
        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand underline-offset-2 hover:underline">
            Sign in
          </Link>
        </p>
      )}
    </>
  );
}
