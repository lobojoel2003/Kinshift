import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import pkg from "./package.json" with { type: "json" };

function gitSha(): string {
  if (process.env.KINSHIFT_COMMIT_SHA && process.env.KINSHIFT_COMMIT_SHA !== "unknown") {
    return process.env.KINSHIFT_COMMIT_SHA;
  }
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  agentRules: false,
  reactStrictMode: true,
  // Every page in Kinshift depends on who is signed in, and health data should
  // never sit in a shared server-side render cache, so the app renders
  // dynamically and does not opt into Cache Components.
  cacheComponents: false,
  serverExternalPackages: ["better-sqlite3", "web-push"],
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**/*"],
  },
  // Kinshift serves no user images, so the image optimizer (and sharp) are not shipped.
  images: { unoptimized: true },
  outputFileTracingExcludes: {
    "*": ["node_modules/sharp/**", "node_modules/@img/**"],
  },
  env: {
    KINSHIFT_VERSION: pkg.version,
    KINSHIFT_BUILD_NUMBER: process.env.KINSHIFT_BUILD_NUMBER || "local",
    KINSHIFT_COMMIT_SHA: gitSha(),
    KINSHIFT_BUILD_DATE: process.env.KINSHIFT_BUILD_DATE || new Date().toISOString(),
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
