import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Authenticated encryption for data at rest.
 *
 * Format: `k1.<iv>.<ciphertext+tag>` (base64url parts). The associated data
 * (AAD) binds every ciphertext to the circle and the field it belongs to, so a
 * value copied into another row, column or circle fails to decrypt instead of
 * being silently accepted.
 */

const VERSION = "k1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class DecryptionError extends Error {
  constructor(message = "Unable to decrypt value") {
    super(message);
    this.name = "DecryptionError";
  }
}

export function encrypt(key: Buffer, plaintext: string, aad: string): string {
  if (key.length !== 32) throw new Error("Encryption key must be 32 bytes");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}.${iv.toString("base64url")}.${Buffer.concat([ciphertext, tag]).toString("base64url")}`;
}

export function decrypt(key: Buffer, payload: string, aad: string): string {
  const parts = payload.split(".");
  if (parts.length !== 3 || parts[0] !== VERSION) {
    throw new DecryptionError("Unrecognised ciphertext format");
  }
  const iv = Buffer.from(parts[1], "base64url");
  const body = Buffer.from(parts[2], "base64url");
  if (iv.length !== IV_BYTES || body.length < TAG_BYTES) {
    throw new DecryptionError("Malformed ciphertext");
  }
  const ciphertext = body.subarray(0, body.length - TAG_BYTES);
  const tag = body.subarray(body.length - TAG_BYTES);
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new DecryptionError();
  }
}

export function isCiphertext(value: string): boolean {
  return /^k1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

/** Derive the key-encryption key from the instance secret. */
export function deriveKek(secret: string): Buffer {
  if (secret.length < 32) throw new Error("KINSHIFT_SECRET must be at least 32 characters");
  return Buffer.from(hkdfSync("sha256", secret, "kinshift", "kinshift/kek/v1", 32));
}

export function generateDataKey(): Buffer {
  return randomBytes(32);
}

export function wrapDataKey(kek: Buffer, dataKey: Buffer, circleId: string): string {
  return encrypt(kek, dataKey.toString("base64"), `circle:${circleId}:dek`);
}

export function unwrapDataKey(kek: Buffer, wrapped: string, circleId: string): Buffer {
  return Buffer.from(decrypt(kek, wrapped, `circle:${circleId}:dek`), "base64");
}

/** A cipher scoped to one circle. `field` names the column, e.g. `journal.body`. */
export class CircleCipher {
  constructor(
    private readonly key: Buffer,
    private readonly circleId: string,
  ) {}

  private aad(field: string) {
    return `${this.circleId}|${field}`;
  }

  enc(field: string, value: string): string {
    return encrypt(this.key, value, this.aad(field));
  }

  dec(field: string, payload: string): string {
    return decrypt(this.key, payload, this.aad(field));
  }

  encOpt(field: string, value: string | null | undefined): string | null {
    return value ? this.enc(field, value) : null;
  }

  decOpt(field: string, payload: string | null | undefined): string | null {
    return payload ? this.dec(field, payload) : null;
  }

  encJson<T>(field: string, value: T): string {
    return this.enc(field, JSON.stringify(value));
  }

  decJson<T>(field: string, payload: string): T {
    return JSON.parse(this.dec(field, payload)) as T;
  }
}
