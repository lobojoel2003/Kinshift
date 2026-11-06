import { describe, expect, it } from "vitest";
import { describeActivity } from "@/lib/activity";
import { colorClasses, nextColor } from "@/lib/colors";
import { fieldErrors, formValues } from "@/lib/forms";
import { newId, newToken, sha256 } from "@/lib/id";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { canAdmin, canEdit, isRole } from "@/lib/roles";
import { safeNext } from "@/lib/urls";
import { z } from "zod";

describe("rate limiting", () => {
  it("allows a burst up to the limit, then blocks until the window passes", () => {
    const key = "test:login";
    resetRateLimit(key);
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 60_000, t + i).ok).toBe(true);
    const blocked = rateLimit(key, 3, 60_000, t + 10);
    expect(blocked.ok).toBe(false);
    expect(rateLimit(key, 3, 60_000, t + 60_001).ok).toBe(true);
  });
});

describe("safe redirects", () => {
  it("only allows same-site relative paths", () => {
    expect(safeNext("/invite/abc")).toBe("/invite/abc");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext(undefined, "")).toBe("");
  });
});

describe("roles and colours", () => {
  it("maps roles to permissions", () => {
    expect(canEdit("owner") && canEdit("caregiver")).toBe(true);
    expect(canEdit("viewer")).toBe(false);
    expect(canAdmin("caregiver")).toBe(false);
    expect(isRole("owner")).toBe(true);
    expect(isRole("admin")).toBe(false);
  });

  it("hands out unused member colours first", () => {
    expect(nextColor([])).toBe("teal");
    expect(nextColor(["teal", "violet"])).toBe("amber");
    expect(colorClasses("nonsense")).toEqual(colorClasses("teal"));
  });
});

describe("ids and tokens", () => {
  it("are random and url-safe", () => {
    expect(newId()).toMatch(/^[A-Za-z0-9_-]{20}$/);
    expect(newToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newId()).not.toBe(newId());
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("forms", () => {
  it("collects values and field errors", () => {
    const fd = new FormData();
    fd.append("name", "Mom");
    fd.append("times", "08:00");
    fd.append("times", "20:00");
    fd.append("$ACTION_ID_123", "x");
    expect(formValues(fd)).toEqual({ name: "Mom", times: "08:00,20:00" });
    const res = z.object({ name: z.string().min(5, "Too short") }).safeParse({ name: "Mom" });
    expect(res.success).toBe(false);
    if (!res.success) expect(fieldErrors(res.error)).toEqual({ name: "Too short" });
  });
});

describe("activity text", () => {
  it("describes events in plain language", () => {
    const tz = "UTC";
    expect(
      describeActivity(
        "dose.given",
        { med: "Metformin", scheduledFor: "2026-11-03T08:00:00Z" },
        tz,
        true,
      ),
    ).toMatch(/gave Metformin \(8:00\sAM dose\)/);
    expect(describeActivity("journal.added", { kind: "handoff" }, tz, true)).toBe(
      "wrote a handoff note",
    );
    expect(describeActivity("member.role", { name: "Sam", role: "owner" }, tz, true)).toBe(
      "made Sam an organizer",
    );
    expect(describeActivity("unknown.thing", {}, tz, true)).toBe("made a change");
  });
});
