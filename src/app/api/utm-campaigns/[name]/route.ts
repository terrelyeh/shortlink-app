import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceId } from "@/lib/workspace";
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
    const workspaceId = getWorkspaceId(request);

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

    // Compute total clicks for all links with this utmCampaign
    const ownerFilter: Record<string, unknown> = workspaceId
      ? { workspaceId }
      : session.user.role === "MEMBER"
      ? { createdById: session.user.id }
      : {};

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
    const workspaceId = getWorkspaceId(request);

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
