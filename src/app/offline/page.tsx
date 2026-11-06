import type { Metadata } from "next";
import { LogoMark } from "@/components/logo";

export const metadata: Metadata = { title: "Offline" };

/**
 * Served by the service worker when there is no connection. Styled inline so it
 * still looks right when the stylesheet cannot be fetched.
 */
export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        textAlign: "center",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <div style={{ width: 56, height: 56 }}>
        <LogoMark className="size-14" />
      </div>
      <h1 style={{ marginTop: "1.5rem", fontSize: "1.25rem", fontWeight: 600 }}>You’re offline</h1>
      <p style={{ marginTop: "0.5rem", maxWidth: "24rem", color: "#5a6964", lineHeight: 1.5 }}>
        Kinshift needs a connection to show the latest doses and schedule, so everyone sees the same
        thing. Tap below once you’re back online.
      </p>
      {/* A plain link forces a full reload, which is what we want after being offline. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/"
        style={{
          marginTop: "1.5rem",
          display: "inline-block",
          padding: "0.7rem 1.25rem",
          borderRadius: "0.75rem",
          background: "#0f766e",
          color: "#fff",
          fontWeight: 500,
          textDecoration: "none",
        }}
      >
        Try again
      </a>
    </main>
  );
}
