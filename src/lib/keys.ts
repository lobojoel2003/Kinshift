import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  CircleCipher,
  DecryptionError,
  decrypt,
  deriveKek,
  encrypt,
  unwrapDataKey,
  wrapDataKey,
} from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { circles } from "@/lib/db/schema";
import { dataDir } from "@/lib/env";

/**
 * Key hierarchy:
 *   KINSHIFT_SECRET (env, or generated key file) -> KEK via HKDF
 *   KEK wraps one random data key per circle (stored in circles.data_key)
 *   each data key encrypts that circle's health data with AES-256-GCM
 *
 * Rotating KINSHIFT_SECRET only re-wraps the small per-circle keys: set the
 * new value, put the old one in KINSHIFT_PREVIOUS_SECRET and restart.
 */

type KeyState = { kek?: Buffer; previousKek?: Buffer | null; dataKeys: Map<string, Buffer> };
const g = globalThis as unknown as { __kinshiftKeys?: KeyState };
const state: KeyState = (g.__kinshiftKeys ??= { dataKeys: new Map() });

function secretFilePath() {
  return path.join(dataDir(), "kinshift.secret");
}

function loadSecret(): string {
  const fromEnv = process.env.KINSHIFT_SECRET?.trim();
  if (fromEnv) return fromEnv;
  const file = secretFilePath();
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const generated = randomBytes(32).toString("hex");
  fs.writeFileSync(file, generated + "\n", { mode: 0o600 });
  console.warn(
    `[kinshift] No KINSHIFT_SECRET set. Generated one at ${file}. ` +
      "Back this file up separately from the database: without it the encrypted data cannot be read.",
  );
  return generated;
}

export function getKek(): Buffer {
  state.kek ??= deriveKek(loadSecret());
  return state.kek;
}

function getPreviousKek(): Buffer | null {
  if (state.previousKek === undefined) {
    const prev = process.env.KINSHIFT_PREVIOUS_SECRET?.trim();
    state.previousKek = prev ? deriveKek(prev) : null;
  }
  return state.previousKek;
}

export function createWrappedDataKey(circleId: string): { wrapped: string; key: Buffer } {
  const key = randomBytes(32);
  return { wrapped: wrapDataKey(getKek(), key, circleId), key };
}

function resolveDataKey(circleId: string, wrapped: string): Buffer {
  try {
    return unwrapDataKey(getKek(), wrapped, circleId);
  } catch (err) {
    const previous = getPreviousKek();
    if (!(err instanceof DecryptionError) || !previous) throw err;
    const key = unwrapDataKey(previous, wrapped, circleId);
    getDb()
      .update(circles)
      .set({ dataKey: wrapDataKey(getKek(), key, circleId) })
      .where(eq(circles.id, circleId))
      .run();
    console.info(`[kinshift] Re-wrapped data key for circle ${circleId} with the new secret.`);
    return key;
  }
}

export function cipherFor(circle: { id: string; dataKey: string }): CircleCipher {
  let key = state.dataKeys.get(circle.id);
  if (!key) {
    key = resolveDataKey(circle.id, circle.dataKey);
    state.dataKeys.set(circle.id, key);
  }
  return new CircleCipher(key, circle.id);
}

export function forgetDataKey(circleId: string) {
  state.dataKeys.delete(circleId);
}

/** Re-wrap every circle key after a secret rotation. Called once on start-up. */
export function rewrapAllDataKeys() {
  if (!getPreviousKek()) return;
  for (const circle of getDb().select().from(circles).all()) {
    try {
      resolveDataKey(circle.id, circle.dataKey);
    } catch (err) {
      console.error(`[kinshift] Could not unwrap key for circle ${circle.id}`, err);
    }
  }
}

/** Encrypt instance-level secrets (for example the VAPID private key). */
export function sealInstanceValue(name: string, value: string): string {
  return encrypt(getKek(), value, `instance:${name}`);
}

export function openInstanceValue(name: string, payload: string): string {
  return decrypt(getKek(), payload, `instance:${name}`);
}
