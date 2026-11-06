import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import "@fontsource-variable/inter";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "Kinshift · Share the care",
    template: "%s · Kinshift",
  },
  description:
    "The family caregiver hub. Track medications together, cover every shift, keep appointments straight and share an encrypted care journal.",
  applicationName: "Kinshift",
  appleWebApp: {
    capable: true,
    title: "Kinshift",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1210" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Render every page per request so the Content Security Policy nonce set in
  // proxy.ts is applied to all scripts.
  await connection();
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        {children}
        <Providers />
      </body>
    </html>
  );
}
