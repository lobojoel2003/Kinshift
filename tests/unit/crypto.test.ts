import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CircleCipher,
  DecryptionError,
  decrypt,
  deriveKek,
  encrypt,
  generateDataKey,
  isCiphertext,
  unwrapDataKey,
  wrapDataKey,
} from "@/lib/crypto";

const key = randomBytes(32);

describe("encrypt / decrypt", () => {
  it("round-trips text, including unicode", () => {
    const text = "Mom took her 8 AM pills 💊 — no dizziness. Ünïcödé ✓";
    const payload = encrypt(key, text, "ctx");
    expect(isCiphertext(payload)).toBe(true);
    expect(payload).not.toContain("pills");
    expect(decrypt(key, payload, "ctx")).toBe(text);
  });

  it("uses a fresh IV every time", () => {
    expect(encrypt(key, "same", "a")).not.toBe(encrypt(key, "same", "a"));
  });

  it("rejects a different associated context", () => {
    const payload = encrypt(key, "secret", "circle-1|journal.body");
    expect(() => decrypt(key, payload, "circle-2|journal.body")).toThrow(DecryptionError);
    expect(() => decrypt(key, payload, "circle-1|task.title")).toThrow(DecryptionError);
  });

  it("detects tampering", () => {
    const payload = encrypt(key, "secret value", "ctx");
    const [v, iv, body] = payload.split(".");
    const bytes = Buffer.from(body, "base64url");
    bytes[0] ^= 0xff;
    expect(() => decrypt(key, `${v}.${iv}.${bytes.toString("base64url")}`, "ctx")).toThrow(
      DecryptionError,
    );
  });

  it("rejects the wrong key and malformed input", () => {
    const payload = encrypt(key, "secret", "ctx");
    expect(() => decrypt(randomBytes(32), payload, "ctx")).toThrow(DecryptionError);
    expect(() => decrypt(key, "not-a-ciphertext", "ctx")).toThrow(DecryptionError);
    expect(() => decrypt(key, "k1.short.x", "ctx")).toThrow(DecryptionError);
  });

  it("requires a 32-byte key", () => {
    expect(() => encrypt(randomBytes(16), "x", "ctx")).toThrow();
  });
});

describe("key hierarchy", () => {
  it("derives a stable key-encryption key from the secret", () => {
    const secret = "a".repeat(40);
    expect(deriveKek(secret).equals(deriveKek(secret))).toBe(true);
    expect(deriveKek(secret).equals(deriveKek("b".repeat(40)))).toBe(false);
    expect(() => deriveKek("too-short")).toThrow(/at least 32/);
  });

  it("wraps and unwraps circle data keys, bound to the circle", () => {
    const kek = deriveKek("x".repeat(64));
    const dek = generateDataKey();
    const wrapped = wrapDataKey(kek, dek, "circle-a");
    expect(unwrapDataKey(kek, wrapped, "circle-a").equals(dek)).toBe(true);
    expect(() => unwrapDataKey(kek, wrapped, "circle-b")).toThrow(DecryptionError);
  });
});

describe("CircleCipher", () => {
  const cipher = new CircleCipher(key, "circle-1");

  it("encrypts JSON documents", () => {
    const doc = { name: "Metformin", dosage: "500 mg" };
    const enc = cipher.encJson("medication.data", doc);
    expect(enc).not.toContain("Metformin");
    expect(cipher.decJson("medication.data", enc)).toEqual(doc);
  });

  it("treats empty optional values as null", () => {
    expect(cipher.encOpt("note", "")).toBeNull();
    expect(cipher.encOpt("note", null)).toBeNull();
    expect(cipher.decOpt("note", null)).toBeNull();
    expect(cipher.decOpt("note", cipher.encOpt("note", "hi"))).toBe("hi");
  });

  it("does not let one field be read as another", () => {
    const enc = cipher.enc("journal.body", "private");
    expect(() => cipher.dec("task.title", enc)).toThrow(DecryptionError);
    expect(() => new CircleCipher(key, "circle-2").dec("journal.body", enc)).toThrow(
      DecryptionError,
    );
  });
});
