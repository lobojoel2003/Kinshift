/**
 * Member and medication colours. Class names are written out in full so
 * Tailwind can find them at build time.
 */

export const COLOR_NAMES = [
  "teal",
  "violet",
  "amber",
  "rose",
  "sky",
  "lime",
  "fuchsia",
  "orange",
] as const;

export type ColorName = (typeof COLOR_NAMES)[number];

export const COLOR_CLASSES: Record<
  ColorName,
  { solid: string; soft: string; text: string; ring: string; bar: string; dot: string }
> = {
  teal: {
    solid: "bg-teal-600 text-white",
    soft: "bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-200",
    text: "text-teal-700 dark:text-teal-300",
    ring: "ring-teal-500",
    bar: "bg-teal-500",
    dot: "bg-teal-500",
  },
  violet: {
    solid: "bg-violet-600 text-white",
    soft: "bg-violet-50 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200",
    text: "text-violet-700 dark:text-violet-300",
    ring: "ring-violet-500",
    bar: "bg-violet-500",
    dot: "bg-violet-500",
  },
  amber: {
    solid: "bg-amber-500 text-amber-950",
    soft: "bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
    text: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-500",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
  },
  rose: {
    solid: "bg-rose-600 text-white",
    soft: "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200",
    text: "text-rose-700 dark:text-rose-300",
    ring: "ring-rose-500",
    bar: "bg-rose-500",
    dot: "bg-rose-500",
  },
  sky: {
    solid: "bg-sky-600 text-white",
    soft: "bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200",
    text: "text-sky-700 dark:text-sky-300",
    ring: "ring-sky-500",
    bar: "bg-sky-500",
    dot: "bg-sky-500",
  },
  lime: {
    solid: "bg-lime-600 text-white",
    soft: "bg-lime-50 text-lime-900 dark:bg-lime-950/60 dark:text-lime-200",
    text: "text-lime-700 dark:text-lime-300",
    ring: "ring-lime-500",
    bar: "bg-lime-500",
    dot: "bg-lime-500",
  },
  fuchsia: {
    solid: "bg-fuchsia-600 text-white",
    soft: "bg-fuchsia-50 text-fuchsia-800 dark:bg-fuchsia-950/60 dark:text-fuchsia-200",
    text: "text-fuchsia-700 dark:text-fuchsia-300",
    ring: "ring-fuchsia-500",
    bar: "bg-fuchsia-500",
    dot: "bg-fuchsia-500",
  },
  orange: {
    solid: "bg-orange-500 text-white",
    soft: "bg-orange-50 text-orange-900 dark:bg-orange-950/60 dark:text-orange-200",
    text: "text-orange-700 dark:text-orange-300",
    ring: "ring-orange-500",
    bar: "bg-orange-500",
    dot: "bg-orange-500",
  },
};

export function colorClasses(name: string | null | undefined) {
  return COLOR_CLASSES[
    (COLOR_NAMES as readonly string[]).includes(name ?? "") ? (name as ColorName) : "teal"
  ];
}

export function isColorName(value: unknown): value is ColorName {
  return typeof value === "string" && (COLOR_NAMES as readonly string[]).includes(value);
}

/** The first colour not used yet by other members, cycling when all are taken. */
export function nextColor(used: string[]): ColorName {
  return (
    COLOR_NAMES.find((c) => !used.includes(c)) ?? COLOR_NAMES[used.length % COLOR_NAMES.length]
  );
}
