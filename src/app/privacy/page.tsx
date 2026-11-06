import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Privacy" };

const sections = [
  {
    title: "Your data lives on this server",
    body: "Kinshift is self-hosted. Everything your family enters is stored in a single database file on the server you are using right now. There is no Kinshift company cloud, no analytics, no ads and no tracking scripts.",
  },
  {
    title: "Health details are encrypted at rest",
    body: "Medication names and instructions, appointment details, journal entries, vitals, the care profile and the activity log are encrypted with AES-256-GCM before they are written to disk. Each care circle has its own key, which is itself encrypted with the server's secret. A stolen copy of the database file alone does not reveal them.",
  },
  {
    title: "Passwords and sessions",
    body: "Passwords are hashed with scrypt. Sign-in sessions are random tokens stored as one-way hashes, and you can sign out other devices from your account settings.",
  },
  {
    title: "Notifications stay discreet",
    body: "Reminders are sent through your browser's push service, encrypted end to end. By default they never include medication names, so nothing sensitive appears on a lock screen.",
  },
  {
    title: "Nothing is cached on your phone",
    body: "The app does not store pages with health information in the browser cache. Only the logo and an offline notice are kept.",
  },
  {
    title: "You can take it with you",
    body: "Organizers can export a circle's complete data as JSON at any time, and delete a circle or an account permanently.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/" className="inline-block">
        <Logo />
      </Link>
      <h1 className="mt-10 text-3xl font-semibold tracking-tight">
        How Kinshift protects your family’s data
      </h1>
      <p className="mt-2 text-muted">
        Caring for someone means handling sensitive information. Kinshift is built so that it stays
        with your family.
      </p>
      <div className="mt-8 space-y-6">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="font-semibold">{s.title}</h2>
            <p className="mt-1 text-muted">{s.body}</p>
          </section>
        ))}
      </div>
      <p className="mt-10 text-sm text-muted">
        The person who runs this server can read the database and its secret key, the same way the
        owner of a filing cabinet can open it. Only use a Kinshift server run by someone you trust.
      </p>
    </div>
  );
}
