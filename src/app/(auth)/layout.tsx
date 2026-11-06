import Link from "next/link";
import { CalendarCheck2, LockKeyhole, Pill, Users } from "lucide-react";
import { Logo } from "@/components/logo";

const points = [
  { icon: Pill, text: "Every dose checked off once, by name, with a timestamp" },
  { icon: CalendarCheck2, text: "A shared schedule that shows exactly who covers Tuesday" },
  { icon: Users, text: "Invite siblings with a link. No app store needed" },
  { icon: LockKeyhole, text: "Notes and health details encrypted on your own server" },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-teal-700 via-teal-800 to-emerald-950 p-12 text-white lg:flex lg:flex-col">
        <Link href="/" className="relative z-10 w-fit">
          <Logo className="text-white" />
        </Link>
        <div className="relative z-10 mt-auto max-w-md">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight">
            Caring for someone is a team effort. Kinshift keeps the team in sync.
          </h2>
          <ul className="mt-8 space-y-4">
            {points.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-teal-50/90">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="size-4" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -bottom-32 size-[28rem] rounded-full bg-teal-400/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-24 -left-24 size-72 rounded-full bg-orange-300/10 blur-3xl"
        />
      </aside>
      <main className="flex flex-col px-5 py-8 sm:px-10">
        <Link href="/" className="mb-10 w-fit lg:hidden">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center pb-10">
          {children}
        </div>
      </main>
    </div>
  );
}
