import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { registrationMode } from "@/lib/env";
import { userCount } from "@/lib/circles";
import { safeNext } from "@/lib/urls";
import { LoginForm } from "../auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams;
  const target = safeNext(next, "");
  if (await getCurrentUser()) redirect(target || "/");
  const firstRun = userCount() === 0;
  if (firstRun) redirect("/signup");
  const canSignUp = registrationMode() === "open";
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 mb-6 text-muted">Sign in to see today’s care plan.</p>
      <LoginForm next={target || undefined} />
      <p className="mt-6 text-center text-sm text-muted">
        {canSignUp ? (
          <>
            New here?{" "}
            <Link
              href="/signup"
              className="font-medium text-brand underline-offset-2 hover:underline"
            >
              Create an account
            </Link>
          </>
        ) : (
          "Joining your family? Open the invite link they sent you."
        )}
      </p>
    </>
  );
}
