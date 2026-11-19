/**
 * One-off backfill — marks historical clicks from automated link
 * scanners as isSuspectedBot=true and rebuilds ShortLink.clickCount so
 * the list numbers stop counting them.
 *
 * Rule (same as src/lib/click-quality.ts, keep them in sync): the UA is
 * Chromium with major version < 100. On 2026-11 data that is ~1,650
 * clicks, ~1,580 of them a single desktop "Chrome/79" UA opening EDM
 * links — corporate mail security gateways.
 *
 * Non-destructive: only sets a flag (clicks are never deleted) and is
 * reversible with --undo. Idempotent: re-running changes nothing.
 * Clicks already marked isInternal are left alone.
 *
 * Dry-run first:
 *   node --env-file=.env scripts/flag-suspected-bot-clicks.mjs
 * Execute:
 *   node --env-file=.env scripts/flag-suspected-bot-clicks.mjs --apply
 * Revert:
 *   node --env-file=.env scripts/flag-suspected-bot-clicks.mjs --undo --apply
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const UNDO = process.argv.includes("--undo");
const MIN_REAL_CHROME_MAJOR = 100; // keep in sync with lib/click-quality.ts

function log(...args) {
  console.log(APPLY ? "[APPLY]" : "[DRY]", ...args);
}

function isSuspected(ua) {
  const m = /(?:Chrome|Chromium|CriOS)\/(\d+)/.exec(ua || "");
  return m ? Number(m[1]) < MIN_REAL_CHROME_MAJOR : false;
}

async function main() {
  const clicks = await prisma.click.findMany({
    where: { isInternal: false },
    select: {
      id: true,
      shortLinkId: true,
      userAgent: true,
      isSuspectedBot: true,
      shortLink: { select: { code: true, utmCampaign: true, utmMedium: true } },
    },
  });

  const target = UNDO
    ? clicks.filter((c) => c.isSuspectedBot)
    : clicks.filter((c) => !c.isSuspectedBot && isSuspected(c.userAgent));

  log(`${UNDO ? "would unflag" : "would flag"} ${target.length} of ${clicks.length} non-test clicks`);

  const byCampaign = new Map();
  const byMedium = new Map();
  for (const c of target) {
    const k = c.shortLink.utmCampaign ?? "(no campaign)";
    byCampaign.set(k, (byCampaign.get(k) ?? 0) + 1);
    const m = c.shortLink.utmMedium ?? "(none)";
    byMedium.set(m, (byMedium.get(m) ?? 0) + 1);
  }
  log("by campaign:", Object.fromEntries([...byCampaign].sort((a, b) => b[1] - a[1])));
  log("by medium:", Object.fromEntries([...byMedium].sort((a, b) => b[1] - a[1])));

  const affectedLinks = [...new Set(target.map((c) => c.shortLinkId))];
  log(`clickCount will be rebuilt for ${affectedLinks.length} links`);

  if (!APPLY) {
    log("dry-run only — re-run with --apply to write");
    return;
  }

  const ids = target.map((c) => c.id);
  for (let i = 0; i < ids.length; i += 500) {
    await prisma.click.updateMany({
      where: { id: { in: ids.slice(i, i + 500) } },
      data: { isSuspectedBot: !UNDO },
    });
  }

  // Rebuild the denormalized counter from what now counts.
  const counts = await prisma.click.groupBy({
    by: ["shortLinkId"],
    where: { shortLinkId: { in: affectedLinks }, isInternal: false, isSuspectedBot: false },
    _count: { _all: true },
  });
  const countMap = new Map(counts.map((c) => [c.shortLinkId, c._count._all]));
  await prisma.$transaction(
    affectedLinks.map((id) =>
      prisma.shortLink.update({ where: { id }, data: { clickCount: countMap.get(id) ?? 0 } }),
    ),
  );
  log(`done: ${ids.length} clicks ${UNDO ? "unflagged" : "flagged"}, ${affectedLinks.length} clickCounts rebuilt`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
