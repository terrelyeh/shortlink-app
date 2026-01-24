import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface CampaignGroupByResult {
  utmCampaign: string | null;
  _count: { id: number };
  _max: { createdAt: Date | null };
}

interface ClickCountResult {
  shortLinkId: string;
  _count: { id: number };
}

interface LinkWithCampaign {
  id: string;
  utmCampaign: string | null;
}

// GET - List unique utm_campaign values with stats
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const limit = parseInt(searchParams.get("limit") || "20");

    const isMember = session.user.role === "MEMBER";
    const userId = session.user.id;

    // Get aggregated campaign data using groupBy
    // Using type assertion to work around Prisma groupBy type limitation
    const campaigns = (await (prisma.shortLink.groupBy as Function)({
      by: ["utmCampaign"],
      where: {
        deletedAt: null,
        utmCampaign: search
          ? { not: null, contains: search, mode: "insensitive" }
          : { not: null },
        ...(isMember ? { createdById: userId } : {}),
      },
      _count: {
        id: true,
      },
      _max: {
        createdAt: true,
      },
      orderBy: {
        _max: {
          createdAt: "desc",
        },
      },
      take: limit,
    })) as CampaignGroupByResult[];

    // Get click counts for each campaign
    const campaignNames = campaigns
      .map((c: CampaignGroupByResult) => c.utmCampaign)
      .filter((name): name is string => name !== null);

    const clickCounts = (await prisma.click.groupBy({
      by: ["shortLinkId"],
      where: {
        shortLink: {
          utmCampaign: { in: campaignNames },
          deletedAt: null,
          ...(session.user.role === "MEMBER" ? { createdById: session.user.id } : {}),
        },
      },
      _count: {
        id: true,
      },
    })) as ClickCountResult[];

    // Get shortLink to campaign mapping for click aggregation
    const linksWithCampaigns = (await prisma.shortLink.findMany({
      where: {
        utmCampaign: { in: campaignNames },
        deletedAt: null,
        ...(session.user.role === "MEMBER" ? { createdById: session.user.id } : {}),
      },
      select: {
        id: true,
        utmCampaign: true,
      },
    })) as LinkWithCampaign[];

    // Aggregate clicks by campaign
    const clicksByLinkId = new Map<string, number>(
      clickCounts.map((c: ClickCountResult) => [c.shortLinkId, c._count.id])
    );

    const clicksByCampaign = new Map<string, number>();
    for (const link of linksWithCampaigns) {
      if (link.utmCampaign) {
        const current = clicksByCampaign.get(link.utmCampaign) || 0;
        const linkClicks = clicksByLinkId.get(link.id) || 0;
        clicksByCampaign.set(link.utmCampaign, current + linkClicks);
      }
    }

    const result = campaigns
      .filter((c: CampaignGroupByResult) => c.utmCampaign !== null)
      .map((c: CampaignGroupByResult) => ({
        name: c.utmCampaign!,
        linkCount: c._count.id,
        clickCount: clicksByCampaign.get(c.utmCampaign!) || 0,
        lastUsed: c._max.createdAt,
      }));

    return NextResponse.json({ campaigns: result });
  } catch (error) {
    console.error("Failed to fetch utm campaigns:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}
