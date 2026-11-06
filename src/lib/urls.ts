import "server-only";
import { headers } from "next/headers";
import { configuredAppUrl } from "@/lib/env";

/** Absolute base URL for links shared outside the app (invites). */
export async function appBaseUrl(): Promise<string> {
  const configured = configuredAppUrl();
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Only allow same-site relative redirects after sign-in. */
export function safeNext(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.length > 300) return fallback;
  return value;
}
