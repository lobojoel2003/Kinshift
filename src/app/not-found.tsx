import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-subtle text-muted">
        <SearchX className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-semibold">We couldn’t find that page</h1>
      <p className="mt-2 max-w-sm text-muted">
        It may have been removed, or you may not have access to it.
      </p>
      <ButtonLink href="/" className="mt-6">
        Go home
      </ButtonLink>
    </main>
  );
}
