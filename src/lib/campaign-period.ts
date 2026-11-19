/**
 * Campaign period (Campaign.startDate / endDate) — the one definition the
 * campaign list, campaign page, goal progress and status all share.
 *
 * Dates are whole days in Taiwan time, inclusive on both ends — the same
 * convention as share-report periods (lib/share-period.ts). They are stored
 * as the instant 00:00 +08:00 of that day; the end bound is that day's
 * 23:59:59.999.
 *
 * Either end may be empty: no start = from the first click, no end = still
 * running. With neither set the "period" is simply all time.
 */

import { toShareDate } from "@/lib/share-period";

const TZ_OFFSET = "+08:00";
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "2027-01-05" → the stored instant (00:00 Taiwan time). */
export function dayToStoredDate(day: string): Date {
  return new Date(`${day}T00:00:00${TZ_OFFSET}`);
}

/** Stored instant → "2027-01-05" (Taiwan calendar day). */
export function storedDateToDay(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return toShareDate(new Date(d));
}

export interface PeriodInput {
  startDate: Date | string | null | undefined;
  endDate: Date | string | null | undefined;
}

export function hasPeriod(p: PeriodInput | null | undefined): boolean {
  return Boolean(p && (p.startDate || p.endDate));
}

/** Timestamp bounds in ms; open ends are ±Infinity. End is inclusive of the whole day. */
export function periodBoundsMs(p: PeriodInput | null | undefined): { fromMs: number; toMs: number } {
  const startDay = storedDateToDay(p?.startDate);
  const endDay = storedDateToDay(p?.endDate);
  return {
    fromMs: startDay ? dayToStoredDate(startDay).getTime() : -Infinity,
    toMs: endDay ? new Date(`${endDay}T23:59:59.999${TZ_OFFSET}`).getTime() : Infinity,
  };
}

/** Prisma `timestamp` filter for the period; {} when unset. */
export function periodTimestampWhere(p: PeriodInput | null | undefined): { gte?: Date; lte?: Date } {
  const { fromMs, toMs } = periodBoundsMs(p);
  return {
    ...(Number.isFinite(fromMs) ? { gte: new Date(fromMs) } : {}),
    ...(Number.isFinite(toMs) ? { lte: new Date(toMs) } : {}),
  };
}

export type CampaignPhase = "archived" | "upcoming" | "running" | "ended";

/**
 * Status shown to users. Only ARCHIVED is set by hand — everything else
 * follows the dates, so nobody has to remember to flip a campaign to
 * "completed". (Stored DRAFT / COMPLETED from older code are treated the
 * same as ACTIVE.)
 */
export function campaignPhase(
  c: PeriodInput & { status?: string | null },
  now: number = Date.now(),
): CampaignPhase {
  if (c.status === "ARCHIVED") return "archived";
  const { fromMs, toMs } = periodBoundsMs(c);
  if (now < fromMs) return "upcoming";
  if (now > toMs) return "ended";
  return "running";
}
