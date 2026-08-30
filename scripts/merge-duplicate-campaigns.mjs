/**
 * One-off cleanup — collapses duplicate Campaign rows so the leaderboard
 * stops splitting one real campaign across several rows.
 *
 * Root cause: `Campaign.name` had no unique constraint, and
 * `upsertCampaignForUtm()` is a findFirst-then-create. Two concurrent link
 * creates with the same utm_campaign both miss the lookup and both insert.
 * (The helper's catch block already expects a unique violation — the
 * constraint it was written for just never existed. Added in the same
 * change as this script.)
 *
 * Two kinds of duplicate are handled:
 *
 *   1. EXACT duplicates — same name in the same workspace. Resolved
 *      automatically: keep the row with the most links (tie → oldest),
 *      re-point the losers' links and tags at it, delete the losers.
 *
 *   2. ALIASES — different spellings of one campaign (e.g. "computex_2026"
 *      vs "computex-26"). Only a human can say these are the same thing,
 *      so they're listed explicitly below. Alongside re-pointing the links
 *      this also rewrites their `utmCampaign` string to the canonical
 *      name — otherwise the next edit of one of those links would call
 *      upsertCampaignForUtm() with the old spelling and recreate the row.
 *
 * Rewriting utmCampaign changes the utm_campaign parameter in the
 * destination URL, so it changes what GA sees for FUTURE clicks on those
 * links. Check the dry-run output before applying.
 *
 * Idempotent: re-runs after a successful pass find nothing to do.
 *
 * Dry-run first:
 *   node --env-file=.env scripts/merge-duplicate-campaigns.mjs
 * Execute:
 *   node --env-file=.env scripts/merge-duplicate-campaigns.mjs --apply
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/**
 * Campaign names that are really the same campaign under different
 * spellings. Key = name to retire, value = canonical name to keep.
 * Both sides are matched within the same workspace.
 */
const ALIASES = {
  computex_2026: "computex-26",
};

function log(...args) {
  console.log(APPLY ? "[APPLY]" : "[DRY]", ...args);
}

/** Fields worth rescuing from a row that's about to be deleted. */
const CARRY_OVER = ["displayName", "description", "goalClicks", "startDate", "endDate", "defaultSource", "defaultMedium"];

/**
 * Fold `losers` into `survivor`: move links and tags across, rescue any
 * metadata the survivor is missing, then delete the loser rows.
 * When `rewriteUtm` is set, the moved links' utmCampaign is rewritten too.
 */
async function fold(survivor, losers, { rewriteUtm = null } = {}) {
  const loserIds = losers.map((c) => c.id);

  const links = await prisma.shortLink.findMany({
    where: { campaignId: { in: loserIds } },
    select: { id: true, code: true, deletedAt: true, utmCampaign: true },
  });

  const live = links.filter((l) => !l.deletedAt).length;
  log(
    `  ← 併入 ${losers.length} 列（${loserIds.map((i) => i.slice(-6)).join(", ")}）：` +
      `${links.length} 條連結（${live} 條有效 / ${links.length - live} 條已刪除）`,
  );
  for (const l of links) {
    const utmNote = rewriteUtm && l.utmCampaign !== rewriteUtm ? ` utm:${l.utmCampaign}→${rewriteUtm}` : "";
    log(`      /${l.code}${l.deletedAt ? " [已刪]" : ""}${utmNote}`);
  }

  // Rescue metadata the survivor doesn't have.
  const patch = {};
  for (const field of CARRY_OVER) {
    if (survivor[field] != null) continue;
    const donor = losers.find((c) => c[field] != null);
    if (donor) patch[field] = donor[field];
  }
  if (Object.keys(patch).length) log(`  ↳ 保留欄位：${JSON.stringify(patch)}`);

  // Tags: move any the survivor doesn't already carry.
  const loserTags = await prisma.tagOnCampaign.findMany({
    where: { campaignId: { in: loserIds } },
    select: { campaignId: true, tagId: true },
  });
  const survivorTags = new Set(
    (
      await prisma.tagOnCampaign.findMany({
        where: { campaignId: survivor.id },
        select: { tagId: true },
      })
    ).map((t) => t.tagId),
  );
  const tagsToMove = [...new Set(loserTags.map((t) => t.tagId))].filter((id) => !survivorTags.has(id));
  if (tagsToMove.length) log(`  ↳ 搬移 ${tagsToMove.length} 個標籤`);

  if (!APPLY) return;

  await prisma.$transaction([
    prisma.shortLink.updateMany({
      where: { campaignId: { in: loserIds } },
      data: { campaignId: survivor.id, ...(rewriteUtm ? { utmCampaign: rewriteUtm } : {}) },
    }),
    ...tagsToMove.map((tagId) =>
      prisma.tagOnCampaign.create({ data: { campaignId: survivor.id, tagId } }),
    ),
    prisma.tagOnCampaign.deleteMany({ where: { campaignId: { in: loserIds } } }),
    ...(Object.keys(patch).length
      ? [prisma.campaign.update({ where: { id: survivor.id }, data: patch })]
      : []),
    prisma.campaign.deleteMany({ where: { id: { in: loserIds } } }),
  ]);
}

/** Most links wins; ties broken by age so the original row survives. */
function pickSurvivor(rows) {
  return [...rows].sort(
    (a, b) => b._count.links - a._count.links || a.createdAt - b.createdAt,
  )[0];
}

async function main() {
  const campaigns = await prisma.campaign.findMany({
    include: { _count: { select: { links: true } } },
    orderBy: { createdAt: "asc" },
  });
  log(`盤點 ${campaigns.length} 個 Campaign\n`);

  // Ids folded away in pass 1. Tracked in memory rather than re-read from
  // the DB so the dry run previews exactly what --apply would do (a dry
  // run deletes nothing, so a re-read would still return them).
  const merged = new Set();

  // ---- Pass 1: exact same-name duplicates -------------------------------
  const byKey = new Map();
  for (const c of campaigns) {
    const key = `${c.workspaceId ?? "NULL"}::${c.name}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(c);
  }

  let exactMerges = 0;
  for (const [key, rows] of byKey) {
    if (rows.length < 2) continue;
    const survivor = pickSurvivor(rows);
    const losers = rows.filter((c) => c.id !== survivor.id);
    log(`重複同名「${key.split("::")[1]}」×${rows.length} → 保留 ${survivor.id.slice(-6)}（${survivor._count.links} 條連結）`);
    await fold(survivor, losers);
    log("");
    exactMerges += losers.length;
    losers.forEach((c) => merged.add(c.id));
  }
  if (!exactMerges) log("沒有同名重複\n");

  // ---- Pass 2: explicit aliases ----------------------------------------
  // Pass 1 already absorbed the same-name losers, so work from the
  // survivors only. Link counts are re-read since pass 1 moved links.
  const remaining = (
    await prisma.campaign.findMany({ include: { _count: { select: { links: true } } } })
  ).filter((c) => !merged.has(c.id));

  let aliasMerges = 0;
  for (const [aliasName, canonicalName] of Object.entries(ALIASES)) {
    const aliases = remaining.filter((c) => c.name === aliasName);
    if (!aliases.length) continue;

    for (const alias of aliases) {
      const canonical = remaining.find(
        (c) => c.name === canonicalName && c.workspaceId === alias.workspaceId,
      );
      if (!canonical) {
        log(`⚠ 別名「${aliasName}」找不到對應的「${canonicalName}」（同一 workspace），跳過`);
        continue;
      }
      log(`別名「${aliasName}」→「${canonicalName}」保留 ${canonical.id.slice(-6)}（${canonical._count.links} 條連結）`);
      await fold(canonical, [alias], { rewriteUtm: canonicalName });
      log("");
      aliasMerges += 1;
    }
  }
  if (!aliasMerges) log("沒有待處理的別名\n");

  log(
    APPLY
      ? `完成：合併掉 ${exactMerges + aliasMerges} 個重複 Campaign。`
      : `Dry run：會合併 ${exactMerges + aliasMerges} 個重複 Campaign（加 --apply 才會實際寫入）。`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
