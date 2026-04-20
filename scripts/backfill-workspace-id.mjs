/**
 * One-off backfill — assigns a workspaceId to every orphan row
 * (workspaceId IS NULL) across the tables that the dashboard scopes
 * by workspace. Necessary because pre-patch API writes left
 * workspaceId unset when no `x-workspace-id` header was sent, which
 * made every workspace show 0 links / campaigns / templates.
 *
 * Strategy per row:
 *   - Use the row's createdById to find that user's default workspace
 *     (their oldest WorkspaceMember row), and backfill it.
 *   - Click / Conversion have no createdById — backfill by joining
 *     through ShortLink.workspaceId once the links are fixed.
 *
 * Idempotent: every update is WHERE workspaceId IS NULL; re-runs are
 * no-ops after the first pass.
 *
 * Dry-run first:
 *   node --env-file=.env scripts/backfill-workspace-id.mjs
 * Execute:
 *   node --env-file=.env scripts/backfill-workspace-id.mjs --apply
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function log(...args) {
  console.log(APPLY ? "[APPLY]" : "[DRY]", ...args);
}

async function defaultWorkspaceIdFor(userId, cache) {
  if (cache.has(userId)) return cache.get(userId);
  const member = await prisma.workspaceMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    select: { workspaceId: true },
  });
  const id = member?.workspaceId ?? null;
  cache.set(userId, id);
  return id;
}

/**
 * Backfill a table whose rows carry createdById. Groups orphans by
 * user so we only look up each user's default workspace once.
 */
async function backfillByCreator(modelName, delegate) {
  const orphans = await delegate.findMany({
    where: { workspaceId: null },
    select: { id: true, createdById: true },
  });
  if (orphans.length === 0) {
    log(`${modelName}: no orphans`);
    return 0;
  }

  const cache = new Map();
  const byWorkspace = new Map(); // workspaceId -> [rowIds]
  let skipped = 0;

  for (const row of orphans) {
    if (!row.createdById) {
      skipped++;
      continue;
    }
    const wsId = await defaultWorkspaceIdFor(row.createdById, cache);
    if (!wsId) {
      skipped++;
      continue;
    }
    if (!byWorkspace.has(wsId)) byWorkspace.set(wsId, []);
    byWorkspace.get(wsId).push(row.id);
  }

  log(
    `${modelName}: ${orphans.length} orphan(s), ${byWorkspace.size} target workspace(s), ${skipped} unassignable`,
  );

  if (!APPLY) return orphans.length - skipped;

  let total = 0;
  for (const [wsId, ids] of byWorkspace.entries()) {
    const res = await delegate.updateMany({
      where: { id: { in: ids }, workspaceId: null },
      data: { workspaceId: wsId },
    });
    total += res.count;
    log(`${modelName}: wrote ${res.count} -> workspace ${wsId}`);
  }
  return total;
}

/**
 * Click / Conversion have no createdById — they sit on a ShortLink.
 * Backfill by joining the fixed parent's workspaceId back down.
 */
async function backfillByShortLink(modelName, delegate) {
  const orphans = await delegate.findMany({
    where: { workspaceId: null, shortLink: { workspaceId: { not: null } } },
    select: { id: true, shortLink: { select: { workspaceId: true } } },
    take: 100000, // sanity cap
  });
  if (orphans.length === 0) {
    log(`${modelName}: no orphans`);
    return 0;
  }

  const byWorkspace = new Map();
  for (const row of orphans) {
    const wsId = row.shortLink?.workspaceId;
    if (!wsId) continue;
    if (!byWorkspace.has(wsId)) byWorkspace.set(wsId, []);
    byWorkspace.get(wsId).push(row.id);
  }

  log(`${modelName}: ${orphans.length} orphan(s) via parent ShortLink`);
  if (!APPLY) return orphans.length;

  let total = 0;
  for (const [wsId, ids] of byWorkspace.entries()) {
    // Chunk to avoid massive IN() lists
    const CHUNK = 500;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const res = await delegate.updateMany({
        where: { id: { in: slice }, workspaceId: null },
        data: { workspaceId: wsId },
      });
      total += res.count;
    }
    log(`${modelName}: wrote ${byWorkspace.get(wsId).length} -> workspace ${wsId}`);
  }
  return total;
}

async function main() {
  console.log(
    APPLY
      ? "Backfill: APPLY mode — writes will be made.\n"
      : "Backfill: dry run (pass --apply to write).\n",
  );

  // Core, user-owned tables first.
  await backfillByCreator("ShortLink", prisma.shortLink);
  await backfillByCreator("Campaign", prisma.campaign);
  await backfillByCreator("UTMTemplate", prisma.uTMTemplate);

  // Click / Conversion inherit workspaceId from their ShortLink.
  // Run AFTER ShortLink backfill so the parent has a workspace.
  await backfillByShortLink("Click", prisma.click);
  await backfillByShortLink("Conversion", prisma.conversion);

  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
