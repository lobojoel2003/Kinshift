import { describe, expect, it } from "vitest";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("correct horse batterY", hash)).toBe(false);
  });

  it("salts every hash", async () => {
    const a = await hashPassword("same password here");
    const b = await hashPassword("same password here");
    expect(a).not.toBe(b);
  });

  it("normalises unicode so the same password typed differently still works", async () => {
    const composed = "café au lait please";
    const decomposed = "café au lait please";
    const hash = await hashPassword(composed);
    expect(await verifyPassword(decomposed, hash)).toBe(true);
  });

  it("rejects malformed stored hashes", async () => {
    expect(await verifyPassword("x", "md5$abc")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
  });
});

describe("password rules", () => {
  it("accepts reasonable passphrases", () => {
    expect(passwordProblem("tea with mom on sundays")).toBeNull();
  });

  it("rejects short, repetitive or common passwords", () => {
    expect(passwordProblem("short")).toMatch(/at least 10/);
    expect(passwordProblem("aaaaaaaaaaaa")).toMatch(/predictable/);
    expect(passwordProblem("mypassword123")).toMatch(/easy to guess/);
    expect(passwordProblem("x".repeat(201))).toMatch(/too long/);
  });
});
