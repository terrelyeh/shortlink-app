/**
 * POST /api/utm-campaigns/[name]/reset-clicks
 *
 * "Soft reset" all real clicks for a campaign — marks them isInternal=true
 * with a fresh resetBatchId so analytics treats them as test data and
 * KPI counters drop to zero. Intended for "we tested for 2 weeks, now
 * launch — start counting from now" scenarios.
 *
 * Body shape:
 *   { mode: "reset" }    → flag all real clicks as internal under a new batch
 *   { mode: "restore", batchId?: string }  → revert: set isInternal=false
 *                          (when batchId provided, only that batch; otherwise
 *                           the most-recent batch for this campaign)
 *
 * Notes:
 *   - Only OWNER/ADMIN of the workspace can run this. canUserActOnResource
 *     would gate per-link, but reset is a campaign-wide action so we check
 *     workspace role directly.
 *   - Hard-coded affected scope: ShortLinks where utmCampaign === name OR
 *     campaignId === campaign.id (matches how the leaderboard groups).
 *   - The redirect handler's own isInternal=true clicks are NOT touched
 *     by restore — they keep their flag (resetBatchId is null for those).
 *   - clickCount denormalized counter is rebuilt from a COUNT() of remaining
 *     real clicks per link rather than incremented/decremented, so any drift
 *     gets corrected as a side effect.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceScope } from "@/lib/workspace";
import { bumpLinksCache } from "@/lib/cache-scopes";
import { randomBytes } from "crypto";
import { z } from "zod";

const bodySchema = z.object({
  mode: z.enum(["reset", "restore"]),
  batchId: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await params;
    const campaignName = decodeURIComponent(name);
    const scope = await resolveWorkspaceScope(request, session);
    if (!scope) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Workspace admin gate. We could fall back to "creator of every
    // affected link" but reset is destructive enough to deserve a
    // dedicated permission. MEMBER/VIEWER cannot reset.
    if (scope.workspaceId) {
      const membership = await prisma.workspaceMember.findFirst({
        where: {
          userId: session.user.id,
          workspaceId: scope.workspaceId,
        },
        select: { role: true },
      });
      if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
        return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
      }
    }

    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { mode, batchId: bodyBatchId } = parsed.data;

    // Find every link belonging to this campaign — same matching rule
    // as the leaderboard: utmCampaign string OR campaignId FK. Catches
    // both auto-linked Campaign rows and bare-utm orphans.
    const campaign = await prisma.campaign.findFirst({
      where: {
        name: campaignName,
        ...(scope.workspaceId ? { workspaceId: scope.workspaceId } : {}),
      },
      select: { id: true },
    });
    const links = await prisma.shortLink.findMany({
      where: {
        deletedAt: null,
        ...scope.where,
        OR: [
          { utmCampaign: campaignName },
          ...(campaign?.id ? [{ campaignId: campaign.id }] : []),
        ],
      },
      select: { id: true },
    });

    if (links.length === 0) {
      return NextResponse.json({
        affectedClicks: 0,
        affectedLinks: 0,
        batchId: null,
        mode,
      });
    }
    const linkIds = links.map((l) => l.id);

    if (mode === "reset") {
      // 16 bytes (128-bit) hex — opaque, sortable enough by createdAt
      // metadata in audit log. Each reset gets its own batch so undo
      // is granular.
      const newBatchId = `rst_${randomBytes(8).toString("hex")}`;

      // Atomic: flag clicks + zero counters + audit log all-or-nothing.
      // Single transaction keeps the click_count consistent with the
      // is_internal flag — analytics never sees a half-updated state.
      const [updateResult] = await prisma.$transaction([
        prisma.click.updateMany({
          where: {
            shortLinkId: { in: linkIds },
            isInternal: false,
          },
          data: {
            isInternal: true,
            resetBatchId: newBatchId,
          },
        }),
        prisma.shortLink.updateMany({
          where: { id: { in: linkIds } },
          data: { clickCount: 0 },
        }),
        prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: "RESET_CAMPAIGN_CLICKS",
            targetId: campaignName,
            metadata: {
              batchId: newBatchId,
              linkCount: linkIds.length,
              campaignName,
            },
          },
        }),
      ]);

      // Bust list + analytics caches so the reset is immediately visible.
      // bumpLinksCache invalidates /api/links; the analytics endpoints
      // are TTL-cached (60s) so they self-heal — fine for this kind
      // of admin action (not user-facing real-time).
      await bumpLinksCache(scope.workspaceId, session.user.id);

      return NextResponse.json({
        affectedClicks: updateResult.count,
        affectedLinks: linkIds.length,
        batchId: newBatchId,
        mode: "reset",
      });
    }

    // mode === "restore"
    // If no batchId provided, find the most recent reset batch for any
    // click in this campaign — convenient "undo last reset" path.
    let restoreBatchId = bodyBatchId;
    if (!restoreBatchId) {
      const recent = await prisma.click.findFirst({
        where: {
          shortLinkId: { in: linkIds },
          resetBatchId: { not: null },
        },
        orderBy: { timestamp: "desc" },
        select: { resetBatchId: true },
      });
      if (!recent?.resetBatchId) {
        return NextResponse.json({
          affectedClicks: 0,
          affectedLinks: linkIds.length,
          batchId: null,
          mode: "restore",
        });
      }
      restoreBatchId = recent.resetBatchId;
    }

    // Recompute clickCount per link from remaining real clicks. Use
    // groupBy + Promise.all for the per-link updates — small N (links
    // per campaign is bounded, realistic max ~100).
    const [updateResult] = await prisma.$transaction([
      prisma.click.updateMany({
        where: {
          shortLinkId: { in: linkIds },
          resetBatchId: restoreBatchId,
        },
        data: {
          isInternal: false,
          resetBatchId: null,
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "RESTORE_CAMPAIGN_CLICKS",
          targetId: campaignName,
          metadata: {
            batchId: restoreBatchId,
            linkCount: linkIds.length,
            campaignName,
          },
        },
      }),
    ]);

    // Rebuild click_count from scratch for affected links — in-loop
    // SQL is OK at this scale (<100 links). raw queryRaw saves a
    // round trip vs read-then-update.
    if (updateResult.count > 0) {
      const counts = await prisma.click.groupBy({
        by: ["shortLinkId"],
        where: {
          shortLinkId: { in: linkIds },
          isInternal: false,
        },
        _count: { _all: true },
      });
      const countMap = new Map(counts.map((c) => [c.shortLinkId, c._count._all]));
      await prisma.$transaction(
        linkIds.map((id) =>
          prisma.shortLink.update({
            where: { id },
            data: { clickCount: countMap.get(id) ?? 0 },
          }),
        ),
      );
    }

    await bumpLinksCache(scope.workspaceId, session.user.id);

    return NextResponse.json({
      affectedClicks: updateResult.count,
      affectedLinks: linkIds.length,
      batchId: restoreBatchId,
      mode: "restore",
    });
  } catch (error) {
    console.error("Failed to reset campaign clicks:", error);
    return NextResponse.json(
      { error: "Failed to reset campaign clicks" },
      { status: 500 },
    );
  }
}
