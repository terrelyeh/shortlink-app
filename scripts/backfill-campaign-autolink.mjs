/**
 * One-off backfill — bridges legacy links that carry a utm_campaign
 * string but no Campaign FK. For each such link, upserts a Campaign
 * row (scoped by workspace or, for user-only links, by creator) and
 * assigns its id to the link.
 *
 * Safe to re-run: findFirst/upsert makes it idempotent.
 *
 * Usage (from project root):
 *   node --env-file=.env scripts/backfill-campaign-autolink.mjs
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function ensureCampaign({ name, workspaceId, userId }) {
  const existing = await prisma.campaign.findFirst({
    where: {
      name,
      ...(workspaceId ? { workspaceId } : { createdById: userId, workspaceId: null }),
    },
    select: { id: true },
  });
  if (existing) return existing.id;

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
}

async function main() {
  const orphans = await prisma.shortLink.findMany({
    where: {
      deletedAt: null,
      campaignId: null,
      utmCampaign: { not: null },
    },
    select: {
      id: true,
      code: true,
      utmCampaign: true,
      workspaceId: true,
      createdById: true,
    },
  });

  console.log(`Found ${orphans.length} orphan links with utmCampaign but no campaignId.`);
  if (orphans.length === 0) {
    await prisma.$disconnect();
    return;
  }

  let createdCampaigns = 0;
  let linkedLinks = 0;
  const campaignCache = new Map(); // key → id

  for (const link of orphans) {
    const name = link.utmCampaign?.trim();
    if (!name) continue;
    // Orphan links without a creator shouldn't exist, but guard anyway.
    if (!link.createdById) {
      console.warn(`  skip ${link.code} — no createdById`);
      continue;
    }

    const cacheKey = `${link.workspaceId ?? "_"}|${link.createdById}|${name}`;
    let campaignId = campaignCache.get(cacheKey);
    if (!campaignId) {
      const before = await prisma.campaign.count({
        where: {
          name,
          ...(link.workspaceId
            ? { workspaceId: link.workspaceId }
            : { createdById: link.createdById, workspaceId: null }),
        },
      });
      campaignId = await ensureCampaign({
        name,
        workspaceId: link.workspaceId,
        userId: link.createdById,
      });
      if (before === 0) createdCampaigns += 1;
      campaignCache.set(cacheKey, campaignId);
    }

    await prisma.shortLink.update({
      where: { id: link.id },
      data: { campaignId },
    });
    linkedLinks += 1;
    console.log(`  linked ${link.code} → campaign "${name}"`);
  }

  console.log(`\nDone. Created ${createdCampaigns} new Campaign rows, linked ${linkedLinks} short links.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
