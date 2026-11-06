import Link, { type LinkProps } from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "soft";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-150 select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-brand-fg shadow-sm hover:bg-brand-strong",
  secondary: "bg-fg text-canvas shadow-sm hover:opacity-90",
  outline: "border border-line-strong bg-surface text-fg shadow-sm hover:bg-subtle",
  ghost: "text-fg hover:bg-subtle",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
  soft: "bg-brand-soft text-brand-strong hover:brightness-95 dark:hover:brightness-125",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-base",
  icon: "size-11",
  "icon-sm": "size-9",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

type ButtonLinkProps = LinkProps &
  Omit<ComponentProps<"a">, keyof LinkProps> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    children: ReactNode;
  };

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
