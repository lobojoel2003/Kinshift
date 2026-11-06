import "server-only";
import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { appSettings, pushSubscriptions } from "@/lib/db/schema";
import { configuredAppUrl } from "@/lib/env";
import { openInstanceValue, sealInstanceValue } from "@/lib/keys";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  urgent?: boolean;
};

type Vapid = { publicKey: string; privateKey: string; subject: string };
const g = globalThis as unknown as { __kinshiftVapid?: Vapid };

function vapidSubject(): string {
  if (process.env.VAPID_SUBJECT) return process.env.VAPID_SUBJECT;
  const url = configuredAppUrl();
  if (url?.startsWith("https://")) return url;
  return "mailto:kinshift@localhost.localdomain";
}

/** VAPID keys from the environment, or generated once and stored (private key encrypted). */
export function getVapid(): Vapid {
  if (g.__kinshiftVapid) return g.__kinshiftVapid;
  const subject = vapidSubject();
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    g.__kinshiftVapid = {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
      subject,
    };
    return g.__kinshiftVapid;
  }
  const db = getDb();
  const row = db.select().from(appSettings).where(eq(appSettings.key, "vapid")).get();
  if (row) {
    const stored = JSON.parse(row.value) as { publicKey: string; privateKey: string };
    g.__kinshiftVapid = {
      publicKey: stored.publicKey,
      privateKey: openInstanceValue("vapid", stored.privateKey),
      subject,
    };
    return g.__kinshiftVapid;
  }
  const keys = webpush.generateVAPIDKeys();
  db.insert(appSettings)
    .values({
      key: "vapid",
      value: JSON.stringify({
        publicKey: keys.publicKey,
        privateKey: sealInstanceValue("vapid", keys.privateKey),
      }),
    })
    .onConflictDoNothing()
    .run();
  g.__kinshiftVapid = { ...keys, subject };
  return g.__kinshiftVapid;
}

export function vapidPublicKey(): string {
  return getVapid().publicKey;
}

/** Send a notification to every device of the given users. Never throws. */
export async function sendPush(userIds: string[], payload: PushPayload): Promise<number> {
  if (userIds.length === 0 || process.env.KINSHIFT_DISABLE_PUSH === "1") return 0;
  const db = getDb();
  const subs = db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, userIds))
    .all();
  if (subs.length === 0) return 0;
  const vapid = getVapid();
  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          {
            TTL: payload.urgent ? 4 * 3600 : 3600,
            urgency: payload.urgent ? "high" : "normal",
            vapidDetails: vapid,
            timeout: 10_000,
          },
        );
        sent++;
        db.update(pushSubscriptions)
          .set({ lastUsedAt: new Date() })
          .where(eq(pushSubscriptions.id, s.id))
          .run();
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id)).run();
        } else {
          console.warn(
            `[kinshift] Push to ${new URL(s.endpoint).host} failed (${status ?? "network"})`,
          );
        }
      }
    }),
  );
  return sent;
}
