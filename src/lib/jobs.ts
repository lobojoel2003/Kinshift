import "server-only";
import { purgeExpiredSessions } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { schedulerEnabled } from "@/lib/env";
import { getKek, rewrapAllDataKeys } from "@/lib/keys";
import { getVapid } from "@/lib/push";
import { runReminderTick } from "@/lib/scheduler";
import { HOUR, MINUTE } from "@/lib/time";

const g = globalThis as unknown as { __kinshiftJobs?: boolean };

/** Called once when the server starts (see src/instrumentation.ts). */
export function startBackgroundJobs() {
  if (g.__kinshiftJobs) return;
  g.__kinshiftJobs = true;

  // Fail fast on start-up if the database or the secret are not usable.
  getDb();
  getKek();
  rewrapAllDataKeys();
  getVapid();
  purgeExpiredSessions();

  if (!schedulerEnabled()) {
    console.info("[kinshift] Reminder scheduler disabled (KINSHIFT_DISABLE_SCHEDULER=1).");
    return;
  }

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runReminderTick();
    } catch (err) {
      console.error("[kinshift] Reminder tick failed", err);
    } finally {
      running = false;
    }
  };

  // Align ticks to a few seconds past each minute so reminders arrive on time.
  const delay = MINUTE - (Date.now() % MINUTE) + 5_000;
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), MINUTE).unref();
  }, delay).unref();
  setInterval(() => purgeExpiredSessions(), 6 * HOUR).unref();
  console.info("[kinshift] Reminder scheduler started.");
}
