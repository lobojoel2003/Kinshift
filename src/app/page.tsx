import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  ClipboardList,
  HeartHandshake,
  LockKeyhole,
  NotebookPen,
  Pill,
  Server,
  Smartphone,
  UsersRound,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { firstCircleId, userCount } from "@/lib/circles";
import { registrationMode } from "@/lib/env";

const features = [
  {
    icon: Pill,
    title: "No missed or doubled doses",
    text: "One shared checklist. When your brother gives the 8 AM pills, you see it instantly, and the app refuses to log the same dose twice.",
  },
  {
    icon: CalendarClock,
    title: "Know who covers Tuesday",
    text: "A weekly care schedule that highlights uncovered hours and open shifts, so gaps get noticed days ahead instead of the morning of.",
  },
  {
    icon: ClipboardList,
    title: "Appointments without clashes",
    text: "Kinshift warns when two visits overlap and when nobody is lined up to take Mom to the cardiologist.",
  },
  {
    icon: NotebookPen,
    title: "Handoffs, not group chats",
    text: "A care journal for handoff notes, vitals and incidents. The next person on duty reads what happened, not 200 chat messages.",
  },
  {
    icon: BellRing,
    title: "Reminders on every phone",
    text: "Push notifications for doses, missed doses, upcoming shifts and appointments, with discreet wording on the lock screen.",
  },
  {
    icon: LockKeyhole,
    title: "Private by design",
    text: "Health details are encrypted at rest with a key per family. You host it, you own it, you can export it any time.",
  },
];

export default async function Home() {
  const user = await getCurrentUser();
  if (user) {
    const circleId = firstCircleId(user.id);
    redirect(circleId ? `/c/${circleId}` : "/onboarding");
  }
  const firstRun = userCount() === 0;
  const open = firstRun || registrationMode() === "open";

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          {!firstRun && (
            <ButtonLink href="/login" variant="ghost">
              Sign in
            </ButtonLink>
          )}
          {open && (
            <ButtonLink href="/signup" variant="primary">
              Get started
            </ButtonLink>
          )}
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pt-10 pb-16 sm:pt-16">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand-strong">
              <HeartHandshake className="size-4" aria-hidden /> The family caregiver hub
            </p>
            <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-6xl">
              Share the care.
              <br />
              <span className="text-brand">Drop the chaos.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-pretty text-muted">
              When siblings share care for a parent, meds get missed or doubled, appointments clash
              and nobody knows who covers Tuesday. Kinshift replaces the group chat and the notes on
              the fridge with one calm, private place the whole family can use from their phones.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {open ? (
                <ButtonLink href="/signup" size="lg">
                  {firstRun ? "Set up your family" : "Create an account"}
                  <ArrowRight aria-hidden />
                </ButtonLink>
              ) : null}
              {!firstRun && (
                <ButtonLink href="/login" size="lg" variant="outline">
                  Sign in
                </ButtonLink>
              )}
            </div>
            {!open && (
              <p className="mt-4 text-sm text-muted">
                Joining your family? Open the invite link they sent you.
              </p>
            )}
          </div>
        </section>

        <section className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-x-8 gap-y-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title}>
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h2 className="mt-4 font-semibold">{title}</h2>
                <p className="mt-1.5 text-[0.95rem] text-muted">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-5 py-14 md:grid-cols-3">
          {[
            {
              icon: Server,
              title: "Runs on your own server",
              text: "One Docker container and one SQLite file. A spare laptop, a NAS or a $5 VPS is plenty.",
            },
            {
              icon: Smartphone,
              title: "Installs like an app",
              text: "Add it to the home screen on iPhone or Android. Works on any modern browser too.",
            },
            {
              icon: UsersRound,
              title: "Made for families",
              text: "Organizers, caregivers and read-only viewers. Invite anyone with a link that expires.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
              <Icon className="size-5 text-brand" aria-hidden />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-muted">
        <span>Kinshift is free and open source under the AGPL-3.0.</span>
        <span className="flex gap-4">
          <Link href="/privacy" className="hover:text-fg">
            Privacy
          </Link>
          <a href="https://github.com/lobojoel2003/Kinshift" className="hover:text-fg">
            Source code
          </a>
        </span>
      </footer>
    </div>
  );
}
