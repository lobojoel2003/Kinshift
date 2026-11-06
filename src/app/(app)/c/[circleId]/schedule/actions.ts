"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { and, eq, gt, gte, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { circleAction, str } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import type { CircleContext } from "@/lib/auth/dal";
import { getShift } from "@/lib/data";
import { getDb } from "@/lib/db";
import { shifts } from "@/lib/db/schema";
import {
  dateString,
  errorState,
  invalid,
  successState,
  text,
  timeString,
  type FormState,
} from "@/lib/forms";
import { newId } from "@/lib/id";
import { notifyCircle } from "@/lib/notify";
import { canEdit } from "@/lib/roles";
import {
  DAY,
  HOUR,
  addDays,
  formatDate,
  formatTimeRange,
  localDateOf,
  minutesOf,
  startOfWeek,
  zonedInstant,
} from "@/lib/time";

const shiftSchema = z.object({
  date: dateString,
  start: timeString,
  end: timeString,
  assigneeId: z.string().max(64).default(""),
  note: text(300, "Note"),
  repeatWeeks: z.coerce.number().int().min(1).max(26).default(1),
  confirm: z.string().optional(),
});

function describe(ctx: CircleContext, startsAt: Date, endsAt: Date) {
  const tz = ctx.circle.timezone;
  return `${formatDate(startsAt, tz, "medium")}, ${formatTimeRange(startsAt, endsAt, tz, ctx.user.hour12)}`;
}

function overlapping(
  ctx: CircleContext,
  assigneeId: string,
  startsAt: Date,
  endsAt: Date,
  exceptId?: string,
) {
  return getDb()
    .select()
    .from(shifts)
    .where(
      and(
        eq(shifts.circleId, ctx.circle.id),
        eq(shifts.assigneeId, assigneeId),
        lt(shifts.startsAt, endsAt),
        gt(shifts.endsAt, startsAt),
        exceptId ? ne(shifts.id, exceptId) : undefined,
      ),
    )
    .all();
}

function weekHref(ctx: CircleContext, at: Date) {
  return `/c/${ctx.circle.id}/schedule?week=${startOfWeek(localDateOf(at, ctx.circle.timezone))}`;
}

export async function saveShift(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "edit", (ctx) => {
    const parsed = shiftSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error, formData);
    const d = parsed.data;
    const tz = ctx.circle.timezone;
    const overnight = minutesOf(d.end) <= minutesOf(d.start);
    const startsAt = zonedInstant(d.date, d.start, tz);
    const endsAt = zonedInstant(overnight ? addDays(d.date, 1) : d.date, d.end, tz);
    if (endsAt.getTime() - startsAt.getTime() > DAY) {
      return invalid(
        new z.ZodError([
          {
            code: "custom",
            path: ["end"],
            message: "Shifts can be at most 24 hours.",
            input: d.end,
          },
        ]),
        formData,
      );
    }
    const assignee = d.assigneeId ? ctx.memberById.get(d.assigneeId) : undefined;
    if (d.assigneeId && (!assignee || !canEdit(assignee.role))) {
      return errorState("Pick a caregiver from this circle, or leave the shift open.");
    }
    const shiftId = str(formData, "shiftId");
    const existing = shiftId ? getShift(ctx, shiftId) : null;
    if (shiftId && !existing) return errorState("That shift was removed.");
    const weeks = existing ? 1 : d.repeatWeeks;

    if (assignee && d.confirm !== "1") {
      const clashes = Array.from({ length: weeks }, (_, i) =>
        overlapping(
          ctx,
          assignee.userId,
          new Date(startsAt.getTime() + i * 7 * DAY),
          new Date(endsAt.getTime() + i * 7 * DAY),
          shiftId || undefined,
        ),
      ).flat();
      if (clashes.length > 0) {
        return {
          status: "error",
          message: "This overlaps another shift.",
          confirm: {
            title: `${assignee.name.split(" ")[0]} already has a shift then`,
            details: clashes.slice(0, 3).map((c) => describe(ctx, c.startsAt, c.endsAt)),
          },
          values: Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)])),
          at: Date.now(),
        };
      }
    }

    const db = getDb();
    const noteEnc = ctx.cipher.encOpt("shift.note", d.note);
    if (existing) {
      db.update(shifts)
        .set({ startsAt, endsAt, assigneeId: assignee?.userId ?? null, noteEnc })
        .where(eq(shifts.id, existing.id))
        .run();
      logActivity({ circleId: ctx.circle.id, cipher: ctx.cipher }, ctx.user.id, "shift.updated", {
        start: startsAt.toISOString(),
      });
    } else {
      const seriesId = weeks > 1 ? newId() : null;
      db.transaction((tx) => {
        for (let i = 0; i < weeks; i++) {
          // Repeat on the same local date and clock time each week, so DST changes keep the hours right.
          const date = addDays(d.date, i * 7);
          tx.insert(shifts)
            .values({
              id: newId(),
              circleId: ctx.circle.id,
              startsAt: zonedInstant(date, d.start, tz),
              endsAt: zonedInstant(overnight ? addDays(date, 1) : date, d.end, tz),
              assigneeId: assignee?.userId ?? null,
              noteEnc,
              seriesId,
              createdBy: ctx.user.id,
              createdAt: new Date(),
            })
            .run();
        }
      });
      logActivity({ circleId: ctx.circle.id, cipher: ctx.cipher }, ctx.user.id, "shift.added", {
        start: startsAt.toISOString(),
        count: weeks,
      });
    }

    const when = describe(ctx, startsAt, endsAt) + (weeks > 1 ? `, weekly for ${weeks} weeks` : "");
    const circleId = ctx.circle.id;
    const me = ctx.user;
    if (assignee && assignee.userId !== me.id && assignee.userId !== existing?.assigneeId) {
      after(() =>
        notifyCircle(
          circleId,
          {
            kind: "shifts",
            title: "You have a new care shift",
            body: `${me.name} put you down for ${when}.`,
            url: weekHref(ctx, startsAt),
            tag: `shift-assign-${startsAt.getTime()}`,
          },
          { to: [assignee.userId] },
        ),
      );
    } else if (!assignee && !existing) {
      after(() =>
        notifyCircle(
          circleId,
          {
            kind: "shifts",
            title: "Open shift needs cover",
            body: `${when}. Can you take it?`,
            url: weekHref(ctx, startsAt),
            tag: `shift-open-${startsAt.getTime()}`,
          },
          { exclude: [me.id] },
        ),
      );
    }
    redirect(weekHref(ctx, startsAt));
  });
}

export async function claimShift(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "edit", (ctx) => {
    const shift = getShift(ctx, str(formData, "shiftId"));
    if (!shift) return errorState("That shift was removed.");
    if (shift.assigneeId && shift.assigneeId !== ctx.user.id) {
      const taker = ctx.memberById.get(shift.assigneeId)?.name ?? "someone else";
      return errorState(`${taker} already took this shift.`);
    }
    // Only claim if it is still open: two siblings tapping at once cannot both get it.
    const res = getDb()
      .update(shifts)
      .set({ assigneeId: ctx.user.id })
      .where(
        and(
          eq(shifts.id, shift.id),
          eq(shifts.circleId, ctx.circle.id),
          shift.assigneeId ? eq(shifts.assigneeId, ctx.user.id) : undefined,
        ),
      )
      .run();
    if (res.changes === 0) return errorState("Someone else just took this shift.");
    logActivity({ circleId: ctx.circle.id, cipher: ctx.cipher }, ctx.user.id, "shift.claimed", {
      start: shift.startsAt.toISOString(),
    });
    return successState(`Thanks! You’re covering ${describe(ctx, shift.startsAt, shift.endsAt)}.`);
  });
}

export async function releaseShift(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "edit", (ctx) => {
    const shift = getShift(ctx, str(formData, "shiftId"));
    if (!shift) return errorState("That shift was removed.");
    if (shift.assigneeId !== ctx.user.id && !ctx.canAdmin) {
      return errorState("Only the person on this shift, or an organizer, can give it up.");
    }
    getDb().update(shifts).set({ assigneeId: null }).where(eq(shifts.id, shift.id)).run();
    logActivity({ circleId: ctx.circle.id, cipher: ctx.cipher }, ctx.user.id, "shift.released", {
      start: shift.startsAt.toISOString(),
    });
    const when = describe(ctx, shift.startsAt, shift.endsAt);
    const circleId = ctx.circle.id;
    const me = ctx.user;
    if (shift.endsAt.getTime() > Date.now()) {
      after(() =>
        notifyCircle(
          circleId,
          {
            kind: "shifts",
            title: "A shift needs cover",
            body: `${me.name} can’t make ${when}. Can you take it?`,
            url: weekHref(ctx, shift.startsAt),
            tag: `shift-open-${shift.id}`,
            urgent: shift.startsAt.getTime() - Date.now() < DAY,
          },
          { exclude: [me.id] },
        ),
      );
    }
    return successState("The shift is open again and your family has been told.");
  });
}

export async function deleteShift(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "edit", (ctx) => {
    const shift = getShift(ctx, str(formData, "shiftId"));
    if (!shift) return errorState("That shift was already removed.");
    if (!ctx.canAdmin && shift.createdBy !== ctx.user.id && shift.assigneeId !== ctx.user.id) {
      return errorState("Only an organizer or the person who added this shift can remove it.");
    }
    const scope = str(formData, "scope");
    const db = getDb();
    let count = 1;
    if (scope === "future" && shift.seriesId) {
      count = db
        .delete(shifts)
        .where(
          and(
            eq(shifts.seriesId, shift.seriesId),
            eq(shifts.circleId, ctx.circle.id),
            gte(shifts.startsAt, shift.startsAt),
          ),
        )
        .run().changes;
    } else {
      db.delete(shifts).where(eq(shifts.id, shift.id)).run();
    }
    logActivity({ circleId: ctx.circle.id, cipher: ctx.cipher }, ctx.user.id, "shift.removed", {
      count,
    });
    redirect(weekHref(ctx, shift.startsAt));
  });
}

/** Take an uncovered stretch of time yourself, straight from the gap warning. */
export async function coverGap(_prev: FormState, formData: FormData): Promise<FormState> {
  return circleAction(formData, "edit", (ctx) => {
    const start = Number(str(formData, "start"));
    const end = Number(str(formData, "end"));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > DAY) {
      return errorState("That time range is not valid.");
    }
    if (end < Date.now() - HOUR) return errorState("That gap is already in the past.");
    const startsAt = new Date(start);
    const endsAt = new Date(end);
    getDb()
      .insert(shifts)
      .values({
        id: newId(),
        circleId: ctx.circle.id,
        startsAt,
        endsAt,
        assigneeId: ctx.user.id,
        createdBy: ctx.user.id,
        createdAt: new Date(),
      })
      .run();
    logActivity({ circleId: ctx.circle.id, cipher: ctx.cipher }, ctx.user.id, "shift.covered", {
      start: startsAt.toISOString(),
      end: endsAt.toISOString(),
    });
    return successState(`You’re covering ${describe(ctx, startsAt, endsAt)}. Thank you!`);
  });
}
