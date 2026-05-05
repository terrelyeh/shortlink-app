import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceScope } from "@/lib/workspace";
import { z } from "zod";

const patchSchema = z.object({
  goalClicks: z.number().int().min(1).nullable(),
});

// GET /api/utm-campaigns/[name] - get campaign stats + goal
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await params;
    const campaignName = decodeURIComponent(name);
    const scope = await resolveWorkspaceScope(request, session);
    if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const workspaceId = scope.workspaceId;

    // Find the Campaign DB record by name (matches utmCampaign)
    const campaign = await prisma.campaign.findFirst({
      where: {
        name: campaignName,
        ...(workspaceId ? { workspaceId } : {}),
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        description: true,
        goalClicks: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    });

    // Compute total clicks for all links with this utmCampaign.
    // Workspace context fully controls visibility — within a workspace,
    // every member sees all links regardless of who created them.
    const ownerFilter: Record<string, unknown> = workspaceId
      ? { workspaceId }
      : { createdById: session.user.id };

    const linksWithCampaign = await prisma.shortLink.findMany({
      where: {
        utmCampaign: campaignName,
        deletedAt: null,
        ...ownerFilter,
      },
      select: {
        id: true,
        _count: { select: { clicks: true } },
      },
    });

    const totalClicks = linksWithCampaign.reduce(
      (sum, l) => sum + l._count.clicks,
      0
    );

    return NextResponse.json({
      campaignName,
      campaignRecord: campaign,
      totalClicks,
      goalClicks: campaign?.goalClicks ?? null,
    });
  } catch (error) {
    console.error("Failed to fetch campaign detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign detail" },
      { status: 500 }
    );
  }
}

// DELETE /api/utm-campaigns/[name] - delete the Campaign row by name.
// Two modes via ?pauseLinks=true|false:
//   - false (default): just remove the Campaign row + unlink its
//     ShortLinks. URLs continue to work, links lose their Campaign
//     binding but keep their utm_campaign string value.
//   - true: also flip every (non-archived) link under this campaign
//     to status=PAUSED. Use this to retire a whole project at once.
//
// If no Campaign row exists but `pauseLinks=true`, we still pause
// links that share the utm_campaign string — useful for cleaning up
// orphan-looking test data.
export async function DELETE(
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
    if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const workspaceId = scope.workspaceId;

    const url = new URL(request.url);
    const pauseLinks = url.searchParams.get("pauseLinks") === "true";

    const campaign = await prisma.campaign.findFirst({
      where: {
        name: campaignName,
        ...(workspaceId ? { workspaceId } : {}),
      },
      select: { id: true, workspaceId: true, createdById: true },
    });

    // Permission: only OWNER/ADMIN of the workspace, or the creator,
    // can delete the campaign. (canUserActOnResource is defined in
    // lib/workspace.ts — but to keep imports tight here we inline the
    // simpler check: workspaceId membership at owner/admin level.)
    if (campaign) {
      const member = workspaceId
        ? await prisma.workspaceMember.findUnique({
            where: {
              workspaceId_userId: { workspaceId, userId: session.user.id },
            },
            select: { role: true },
          })
        : null;
      const isCreator = campaign.createdById === session.user.id;
      const isAdmin = member?.role === "OWNER" || member?.role === "ADMIN";
      if (!isCreator && !isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Unlink (and optionally pause) all linked ShortLinks. Filter by
    // utmCampaign string so we catch links that lost their campaignId
    // FK at some earlier point but still carry the same UTM tag.
    const linkWhere = {
      ...(workspaceId ? { workspaceId } : {}),
      OR: [
        ...(campaign ? [{ campaignId: campaign.id }] : []),
        { utmCampaign: campaignName },
      ],
      deletedAt: null,
      status: { not: "ARCHIVED" as const },
    };

    let pausedCount = 0;
    if (pauseLinks) {
      const res = await prisma.shortLink.updateMany({
        where: linkWhere,
        data: { campaignId: null, status: "PAUSED" },
      });
      pausedCount = res.count;
    } else if (campaign) {
      // Just unlink — keep URLs functional.
      await prisma.shortLink.updateMany({
        where: { campaignId: campaign.id },
        data: { campaignId: null },
      });
    }

    if (campaign) {
      await prisma.campaign.delete({ where: { id: campaign.id } });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE_CAMPAIGN",
        targetId: campaign?.id ?? campaignName,
        metadata: {
          name: campaignName,
          pausedLinks: pauseLinks,
          pausedCount,
          campaignRowDeleted: Boolean(campaign),
        },
      },
    });

    return NextResponse.json({ success: true, pausedCount });
  } catch (error) {
    console.error("Failed to delete campaign:", error);
    return NextResponse.json(
      { error: "Failed to delete campaign" },
      { status: 500 },
    );
  }
}

// PATCH /api/utm-campaigns/[name] - set/update goalClicks
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await params;
    const campaignName = decodeURIComponent(name);
    const scope = await resolveWorkspaceScope(request, session);
    if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const workspaceId = scope.workspaceId;

    const body = await request.json();
    const { goalClicks } = patchSchema.parse(body);

    // Find or create Campaign record
    let campaign = await prisma.campaign.findFirst({
      where: {
        name: campaignName,
        ...(workspaceId ? { workspaceId } : {}),
      },
    });

    if (campaign) {
      campaign = await prisma.campaign.update({
        where: { id: campaign.id },
        data: { goalClicks },
      });
    } else {
      campaign = await prisma.campaign.create({
        data: {
          name: campaignName,
          goalClicks,
          status: "ACTIVE",
          createdById: session.user.id,
          workspaceId: workspaceId || undefined,
        },
      });
    }

    return NextResponse.json({ success: true, goalClicks: campaign.goalClicks });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Failed to update campaign goal:", error);
    return NextResponse.json(
      { error: "Failed to update campaign goal" },
      { status: 500 }
    );
  }
}
