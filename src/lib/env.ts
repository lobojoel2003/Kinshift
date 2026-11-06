import path from "node:path";

// Paths are resolved at runtime from environment variables, so the bundler is
// told not to trace them (`turbopackIgnore`).

/**
 * Runtime configuration. Everything is read lazily so a single Docker image
 * can be configured purely through environment variables at start-up.
 */
export function dataDir(): string {
  return path.resolve(
    /*turbopackIgnore: true*/ process.env.DATA_DIR ?? path.join(process.cwd(), "data"),
  );
}

export function databasePath(): string {
  return path.resolve(
    /*turbopackIgnore: true*/ process.env.DATABASE_PATH ?? path.join(dataDir(), "kinshift.db"),
  );
}

export function migrationsDir(): string {
  return path.resolve(
    /*turbopackIgnore: true*/ process.env.KINSHIFT_MIGRATIONS_DIR ??
      path.join(process.cwd(), "drizzle"),
  );
}

export type RegistrationMode = "open" | "invite";

/**
 * `invite` (default): the very first person can create an account, after that
 * new accounts can only be created from an invite link.
 * `open`: anyone who can reach the server can sign up.
 */
export function registrationMode(): RegistrationMode {
  return process.env.KINSHIFT_REGISTRATION === "open" ? "open" : "invite";
}

/** Public base URL, used for invite links when set. Otherwise derived from the request. */
export function configuredAppUrl(): string | undefined {
  const url = process.env.KINSHIFT_URL?.trim();
  return url ? url.replace(/\/+$/, "") : undefined;
}

export function schedulerEnabled(): boolean {
  return process.env.KINSHIFT_DISABLE_SCHEDULER !== "1";
}

export const appVersion = {
  version: process.env.KINSHIFT_VERSION ?? "0.0.0",
  build: process.env.KINSHIFT_BUILD_NUMBER ?? "local",
  commit: process.env.KINSHIFT_COMMIT_SHA ?? "unknown",
  builtAt: process.env.KINSHIFT_BUILD_DATE ?? "",
};
