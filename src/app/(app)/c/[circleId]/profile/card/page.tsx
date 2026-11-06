import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireCircle } from "@/lib/auth/dal";
import { getProfile, listMedications } from "@/lib/data";
import { describeSchedule } from "@/lib/meds";
import { ageFrom, formatDateString, todayIn } from "@/lib/time";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Emergency card" };

export default async function EmergencyCardPage(props: PageProps<"/c/[circleId]/profile/card">) {
  const { circleId } = await props.params;
  const ctx = await requireCircle(circleId);
  const { data: p } = getProfile(ctx);
  const meds = listMedications(ctx);
  const today = todayIn(ctx.circle.timezone);
  const age = ageFrom(p.dateOfBirth, today);
  const primary = p.providers[0];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link
          href={`/c/${circleId}/profile`}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
        >
          <ChevronLeft className="size-4" aria-hidden /> Care profile
        </Link>
        <PrintButton />
      </div>
      <article className="rounded-2xl border-2 border-red-600 bg-white p-6 text-zinc-900 shadow-card print:border-black print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4">
          <div>
            <p className="text-xs font-bold tracking-widest text-red-600 uppercase">
              Medical information
            </p>
            <h1 className="mt-1 text-3xl font-bold">
              {p.preferredName || ctx.circle.recipientName}
            </h1>
            <p className="text-zinc-600">
              {[
                p.dateOfBirth ? `Born ${formatDateString(p.dateOfBirth, "long")}` : "",
                age !== null ? `${age} years` : "",
                p.bloodType ? `Blood ${p.bloodType}` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <p className="text-right text-xs text-zinc-500">
            Printed {formatDateString(today, "long")}
          </p>
        </header>

        <section className="mt-4 rounded-xl bg-red-50 p-3">
          <h2 className="text-sm font-bold text-red-700 uppercase">Allergies</h2>
          <p className="text-lg font-semibold whitespace-pre-wrap">{p.allergies || "None known"}</p>
        </section>

        {p.conditions && (
          <section className="mt-4">
            <h2 className="text-sm font-bold text-zinc-500 uppercase">Conditions</h2>
            <p className="whitespace-pre-wrap">{p.conditions}</p>
          </section>
        )}

        <section className="mt-4">
          <h2 className="text-sm font-bold text-zinc-500 uppercase">Current medications</h2>
          {meds.length === 0 ? (
            <p>None recorded</p>
          ) : (
            <table className="mt-1 w-full text-left text-sm">
              <tbody>
                {meds.map((m) => (
                  <tr key={m.id} className="border-b border-zinc-100 last:border-0">
                    <td className="py-1 pr-3 font-semibold">{m.name}</td>
                    <td className="py-1 pr-3">{m.dosage}</td>
                    <td className="py-1 text-zinc-600">{describeSchedule(m, ctx.user.hour12)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {p.advanceDirective && (
          <section className="mt-4">
            <h2 className="text-sm font-bold text-zinc-500 uppercase">Advance directive</h2>
            <p>{p.advanceDirective}</p>
          </section>
        )}
        {p.communication && (
          <section className="mt-4">
            <h2 className="text-sm font-bold text-zinc-500 uppercase">Communication</h2>
            <p>{p.communication}</p>
          </section>
        )}

        <section className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <h2 className="text-sm font-bold text-zinc-500 uppercase">Emergency contacts</h2>
            {p.emergencyContacts.length === 0 ? (
              <p>Not recorded</p>
            ) : (
              <ul>
                {p.emergencyContacts.map((c, i) => (
                  <li key={i}>
                    <strong>{c.name}</strong> {c.relation && `(${c.relation})`} {c.phone}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-500 uppercase">Doctor & pharmacy</h2>
            {primary && (
              <p>
                <strong>{primary.name}</strong> {primary.specialty && `(${primary.specialty})`}{" "}
                {primary.phone}
              </p>
            )}
            {p.pharmacy && <p>{p.pharmacy}</p>}
            {p.insurance && <p className="text-sm text-zinc-600">Insurance: {p.insurance}</p>}
            {!primary && !p.pharmacy && <p>Not recorded</p>}
          </div>
        </section>
      </article>
      <p className="no-print mt-3 text-center text-sm text-muted">
        Print it or save it as a PDF and keep a copy in the hospital bag.
      </p>
    </div>
  );
}
