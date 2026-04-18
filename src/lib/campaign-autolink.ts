/**
 * Bridges the UTM-string world and the Campaign-entity world.
 *
 * The schema has two overlapping concepts:
 *   - `ShortLink.utmCampaign` — free-text UTM value (goes into the URL)
 *   - `Campaign`               — first-class entity with goals, status,
 *                                display name, and its own Detail page
 *
 * Marketers don't naturally distinguish these; typing "spring_sale" into
 * the UTM campaign field should make a Campaign row appear so goals /
 * leaderboard / detail view all work without asking them to double-enter
 * the same name on a different page.
 *
 * This helper upserts the Campaign and returns its id so the caller can
 * set ShortLink.campaignId atomically in the same create/update.
 */

import { prisma } from "@/lib/prisma";

/**
 * Ensure a Campaign row exists for the given utm-campaign string within
 * the supplied workspace scope. Returns the Campaign id to assign to
 * ShortLink.campaignId.
 *
 * Matching rules:
 *   - `name` (the machine-safe slug) is the primary key we upsert on
 *   - matched within the same workspaceId when one is supplied so two
 *     workspaces can legitimately have independently-owned campaigns
 *     with the same name
 *   - when workspaceId is null (user-scope fallback) we match by name
 *     + createdById so different users' utm values don't collide
 *
 * No-op (returns null) when utmCampaign is empty.
 */
export async function upsertCampaignForUtm({
  utmCampaign,
  workspaceId,
  userId,
}: {
  utmCampaign: string | null | undefined;
  workspaceId: string | null;
  userId: string;
}): Promise<string | null> {
  if (!utmCampaign || !utmCampaign.trim()) return null;
  const name = utmCampaign.trim();

  const existing = await prisma.campaign.findFirst({
    where: {
      name,
      ...(workspaceId ? { workspaceId } : { createdById: userId, workspaceId: null }),
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  try {
    const created = await prisma.campaign.create({
      data: {
        name,
        status: "ACTIVE",
        createdById: userId,
        workspaceId: workspaceId ?? undefined,
      },
      select: { id: true },
    });
    return created.id;
  } catch (err) {
    // Unique violation means a concurrent create won — look it up again.
    // Any other error we bubble up so the caller sees it.
    const fallback = await prisma.campaign.findFirst({
      where: {
        name,
        ...(workspaceId ? { workspaceId } : { createdById: userId, workspaceId: null }),
      },
      select: { id: true },
    });
    if (fallback) return fallback.id;
    throw err;
  }
}
