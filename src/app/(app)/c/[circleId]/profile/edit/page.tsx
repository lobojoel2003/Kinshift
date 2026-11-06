import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { requireCircle } from "@/lib/auth/dal";
import { getProfile } from "@/lib/data";
import { ProfileForm } from "../profile-form";

export const metadata: Metadata = { title: "Edit care profile" };

export default async function EditProfilePage(props: PageProps<"/c/[circleId]/profile/edit">) {
  const { circleId } = await props.params;
  const ctx = await requireCircle(circleId, "edit");
  const { data } = getProfile(ctx);
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/c/${circleId}/profile`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
      >
        <ChevronLeft className="size-4" aria-hidden /> Care profile
      </Link>
      <PageHeader
        title={`${ctx.circle.recipientName}’s care profile`}
        description="Fill in what you know. Everything is optional and can be updated any time."
      />
      <ProfileForm circleId={circleId} recipientName={ctx.circle.recipientName} initial={data} />
    </div>
  );
}
