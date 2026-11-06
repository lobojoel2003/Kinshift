import { createHash, randomBytes } from "node:crypto";

/** 20-character URL-safe random identifier (120 bits). */
export function newId(): string {
  return randomBytes(15).toString("base64url");
}

/** 43-character URL-safe random secret token (256 bits). */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
