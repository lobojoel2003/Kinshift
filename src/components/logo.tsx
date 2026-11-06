import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden className={cn("size-8", className)}>
      <defs>
        <linearGradient id="kinshift-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#17b3a1" />
          <stop offset="1" stopColor="#0b655e" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#kinshift-bg)" />
      <g transform="translate(70 86) scale(15)">
        <path
          d="M12 6.8C10.6 5 8.7 3.9 6.6 4.1 2.9 4.5.9 8.4 2.4 11.8 4.5 16.4 12 21 12 21z"
          fill="#ffffff"
        />
        <path
          d="M12 6.8c1.4-1.8 3.3-2.9 5.4-2.7 3.7.4 5.7 4.3 4.2 7.7C19.5 16.4 12 21 12 21z"
          fill="#ffb3a1"
          transform="translate(0.8 -0.8)"
        />
      </g>
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={markClassName} />
      <span className="text-lg font-semibold tracking-tight">Kinshift</span>
    </span>
  );
}
