/**
 * Campaign click goals: an optional per-channel split (Campaign.goalByMedium,
 * keyed by utm_medium) and the pace line ("where should we be by now").
 *
 * The total (Campaign.goalClicks) stays the source for the campaign list;
 * when a split exists the API keeps goalClicks equal to its sum.
 */

import { periodBoundsMs, type PeriodInput } from "@/lib/campaign-period";

export type GoalByMedium = Record<string, number>;

export const MAX_GOAL_CHANNELS = 20;

/** Accepts the raw Json column; returns null unless it's a non-empty { medium: positive int } map. */
export function parseGoalByMedium(v: unknown): GoalByMedium | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: GoalByMedium = {};
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    if (k && typeof n === "number" && Number.isInteger(n) && n > 0) out[k] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function sumGoal(g: GoalByMedium): number {
  return Object.values(g).reduce((a, b) => a + b, 0);
}

/**
 * Share of the campaign period that has elapsed (0–1), i.e. how much of
 * the goal a linear pace would expect by `now`. Null without both a start
 * and an end date — there's no pace to speak of.
 */
export function goalPaceFraction(p: PeriodInput | null | undefined, now: number = Date.now()): number | null {
  if (!p?.startDate || !p?.endDate) return null;
  const { fromMs, toMs } = periodBoundsMs(p);
  if (!(toMs > fromMs)) return null;
  return Math.min(1, Math.max(0, (now - fromMs) / (toMs - fromMs)));
}
