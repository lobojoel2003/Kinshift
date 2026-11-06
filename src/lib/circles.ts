import "server-only";
import { count, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { circles, memberships, users } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { createWrappedDataKey } from "@/lib/keys";
import { CircleCipher } from "@/lib/crypto";
import { logActivity } from "@/lib/activity";

export function createCircle(input: {
  userId: string;
  recipientName: string;
  name?: string;
  timezone: string;
  relationship?: string | null;
  coverageStart?: string;
  coverageEnd?: string;
}): string {
  const id = newId();
  const { wrapped, key } = createWrappedDataKey(id);
  const db = getDb();
  db.transaction((tx) => {
    tx.insert(circles)
      .values({
        id,
        name: input.name?.trim() || `Caring for ${input.recipientName}`,
        recipientName: input.recipientName,
        timezone: input.timezone,
        dataKey: wrapped,
        coverageStart: input.coverageStart ?? "08:00",
        coverageEnd: input.coverageEnd ?? "20:00",
        createdBy: input.userId,
        createdAt: new Date(),
      })
      .run();
    tx.insert(memberships)
      .values({
        id: newId(),
        circleId: id,
        userId: input.userId,
        role: "owner",
        relationship: input.relationship || null,
        color: "teal",
        createdAt: new Date(),
      })
      .run();
  });
  logActivity({ circleId: id, cipher: new CircleCipher(key, id) }, input.userId, "circle.created");
  return id;
}

export function userCount(): number {
  return getDb().select({ n: count() }).from(users).get()?.n ?? 0;
}

export function firstCircleId(userId: string): string | null {
  return (
    getDb()
      .select({ id: memberships.circleId })
      .from(memberships)
      .where(eq(memberships.userId, userId))
      .orderBy(memberships.createdAt)
      .get()?.id ?? null
  );
}
