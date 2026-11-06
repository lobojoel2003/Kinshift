import type { Metadata } from "next";
import Link from "next/link";
import { HeartPulse, IdCard, Pencil, Phone, Pill, TriangleAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, EmptyState, PageHeader } from "@/components/ui/misc";
import { requireCircle } from "@/lib/auth/dal";
import { getProfile, listMedications } from "@/lib/data";
import { describeSchedule } from "@/lib/meds";
import { ageFrom, formatDateString, formatRelative, todayIn } from "@/lib/time";

export const metadata: Metadata = { title: "Care profile" };

function Detail({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

export default async function ProfilePage(props: PageProps<"/c/[circleId]/profile">) {
  const { circleId } = await props.params;
  const sp = await props.searchParams;
  const ctx = await requireCircle(circleId);
  const { data: p, updatedAt, updatedBy } = getProfile(ctx);
  const meds = listMedications(ctx);
  const today = todayIn(ctx.circle.timezone);
  const age = ageFrom(p.dateOfBirth, today);
  const editor = updatedBy ? ctx.memberById.get(updatedBy) : undefined;
  const base = `/c/${circleId}`;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={p.preferredName || ctx.circle.recipientName}
        description={
          [
            age !== null ? `${age} years old` : "",
            p.pronouns,
            p.bloodType ? `Blood type ${p.bloodType}` : "",
          ]
            .filter(Boolean)
            .join(" · ") || "Care profile"
        }
        actions={
          <>
            <ButtonLink href={`${base}/profile/card`} variant="outline" size="sm">
              <IdCard aria-hidden /> Emergency card
            </ButtonLink>
            {ctx.canEdit && (
              <ButtonLink href={`${base}/profile/edit`} size="sm">
                <Pencil aria-hidden /> Edit
              </ButtonLink>
            )}
          </>
        }
      />
      {sp.saved && (
        <Alert tone="success" className="mb-5">
          Profile saved.
        </Alert>
      )}

      {!updatedAt ? (
        <EmptyState
          icon={<HeartPulse />}
          title="No profile yet"
          action={
            ctx.canEdit && (
              <ButtonLink href={`${base}/profile/edit`}>
                <Pencil aria-hidden /> Fill it in
              </ButtonLink>
            )
          }
        >
          Allergies, conditions, the care team and emergency contacts, all in one encrypted place.
          It also powers a printable emergency card for hospital visits.
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {p.allergies && (
            <Alert tone="danger" title="Allergies">
              <span className="whitespace-pre-wrap">{p.allergies}</span>
            </Alert>
          )}
          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <CardHeader title="Health" icon={<HeartPulse />} />
              <CardBody>
                <dl className="space-y-3">
                  <Detail label="Conditions" value={p.conditions} />
                  <Detail
                    label="Date of birth"
                    value={p.dateOfBirth ? formatDateString(p.dateOfBirth, "long") : ""}
                  />
                  <Detail label="Advance directive" value={p.advanceDirective} />
                  <Detail label="Other notes" value={p.medicalNotes} />
                </dl>
                {!p.conditions && !p.medicalNotes && !p.advanceDirective && (
                  <p className="text-sm text-muted">Nothing recorded.</p>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader
                title="Current medications"
                icon={<Pill />}
                action={
                  <Link
                    href={`${base}/meds`}
                    className="text-sm font-medium text-brand hover:underline"
                  >
                    Manage
                  </Link>
                }
              />
              <CardBody>
                {meds.length === 0 ? (
                  <p className="text-sm text-muted">None added.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {meds.map((m) => (
                      <li key={m.id}>
                        <span className="font-medium">{m.name}</span>{" "}
                        {m.dosage && <span className="text-muted">{m.dosage}</span>}
                        <p className="text-muted">{describeSchedule(m, ctx.user.hour12)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Daily life" />
              <CardBody>
                <dl className="space-y-3">
                  <Detail label="Mobility" value={p.mobility} />
                  <Detail label="Diet" value={p.diet} />
                  <Detail label="Communication" value={p.communication} />
                  <Detail label="Routines and preferences" value={p.routines} />
                </dl>
                {!p.mobility && !p.diet && !p.communication && !p.routines && (
                  <p className="text-sm text-muted">Nothing recorded.</p>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Contacts" icon={<Phone />} />
              <CardBody className="space-y-4">
                {[
                  {
                    title: "Emergency contacts",
                    list: p.emergencyContacts.map((c) => ({
                      name: c.name,
                      sub: c.relation,
                      phone: c.phone,
                    })),
                  },
                  {
                    title: "Care team",
                    list: p.providers.map((c) => ({
                      name: c.name,
                      sub: c.specialty,
                      phone: c.phone,
                    })),
                  },
                ].map(
                  (group) =>
                    group.list.length > 0 && (
                      <div key={group.title}>
                        <p className="mb-1.5 text-sm text-muted">{group.title}</p>
                        <ul className="space-y-1.5">
                          {group.list.map((c, i) => (
                            <li key={i} className="flex items-center justify-between gap-3 text-sm">
                              <span>
                                <span className="font-medium">{c.name}</span>
                                {c.sub && <span className="text-muted"> · {c.sub}</span>}
                              </span>
                              {c.phone && (
                                <a
                                  href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}
                                  className="tabular font-medium text-brand hover:underline"
                                >
                                  {c.phone}
                                </a>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ),
                )}
                <dl className="space-y-3">
                  <Detail label="Pharmacy" value={p.pharmacy} />
                  <Detail label="Insurance" value={p.insurance} />
                </dl>
              </CardBody>
            </Card>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <TriangleAlert className="size-3.5" aria-hidden />
            Last updated {formatRelative(updatedAt)}
            {editor ? ` by ${editor.name}` : ""}. Keep it current: it’s what a paramedic or new
            helper will read.
          </p>
        </div>
      )}
    </div>
  );
}
