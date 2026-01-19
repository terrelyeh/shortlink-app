import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "7d";
    const linkId = searchParams.get("linkId");

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (range) {
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Base query conditions
    const whereClicks: Record<string, unknown> = {
      timestamp: { gte: startDate },
    };

    const whereLinks: Record<string, unknown> = {
      deletedAt: null,
    };

    // Filter by user role
    if (session.user.role === "MEMBER") {
      whereLinks.userId = session.user.id;
    }

    if (linkId) {
      whereClicks.shortLinkId = linkId;
    } else {
      // Get user's links
      const userLinks = await prisma.shortLink.findMany({
        where: whereLinks,
        select: { id: true },
      });
      whereClicks.shortLinkId = { in: userLinks.map((l) => l.id) };
    }

    // Get total clicks
    const totalClicks = await prisma.click.count({ where: whereClicks });

    // Get unique visitors (by IP hash)
    const uniqueVisitors = await prisma.click.groupBy({
      by: ["ipHash"],
      where: whereClicks,
    });

    // Get clicks by day using Prisma's groupBy instead of raw SQL
    const clicksByDayRaw = await prisma.click.groupBy({
      by: ["timestamp"],
      where: whereClicks,
      _count: true,
    });

    // Aggregate by date
    const clicksByDayMap = new Map<string, number>();
    clicksByDayRaw.forEach((c) => {
      const dateStr = c.timestamp.toISOString().split("T")[0];
      clicksByDayMap.set(dateStr, (clicksByDayMap.get(dateStr) || 0) + c._count);
    });

    const clicksByDay = Array.from(clicksByDayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get device distribution
    const deviceStats = await prisma.click.groupBy({
      by: ["device"],
      where: whereClicks,
      _count: true,
    });

    // Get browser distribution
    const browserStats = await prisma.click.groupBy({
      by: ["browser"],
      where: whereClicks,
      _count: true,
    });

    // Get OS distribution
    const osStats = await prisma.click.groupBy({
      by: ["os"],
      where: whereClicks,
      _count: true,
    });

    // Get top referrers
    const referrerStats = await prisma.click.groupBy({
      by: ["referrer"],
      where: {
        ...whereClicks,
        referrer: { not: null },
      },
      _count: true,
      orderBy: { _count: { referrer: "desc" } },
      take: 10,
    });

    // Get country distribution
    const countryStats = await prisma.click.groupBy({
      by: ["country"],
      where: {
        ...whereClicks,
        country: { not: null },
      },
      _count: true,
      orderBy: { _count: { country: "desc" } },
      take: 10,
    });

    // Get top performing links
    const topLinks = await prisma.shortLink.findMany({
      where: whereLinks,
      include: {
        _count: {
          select: { clicks: true },
        },
      },
      orderBy: {
        clicks: { _count: "desc" },
      },
      take: 10,
    });

    // ============================================
    // UTM Analytics
    // ============================================

    // Get all links with UTM parameters and their click counts
    const linksWithUTM = await prisma.shortLink.findMany({
      where: {
        ...whereLinks,
        OR: [
          { utmCampaign: { not: null } },
          { utmSource: { not: null } },
          { utmMedium: { not: null } },
        ],
      },
      include: {
        clicks: {
          where: {
            timestamp: { gte: startDate },
          },
          select: { id: true },
        },
      },
    });

    // Campaign breakdown: Campaign → Clicks
    const campaignMap = new Map<string, number>();
    // Source breakdown: Source → Clicks
    const sourceMap = new Map<string, number>();
    // Medium breakdown: Medium → Clicks
    const mediumMap = new Map<string, number>();
    // Campaign × Source: "campaign|source" → Clicks
    const campaignSourceMap = new Map<string, { campaign: string; source: string; clicks: number }>();
    // Campaign × Content: "campaign|content" → Clicks
    const campaignContentMap = new Map<string, { campaign: string; content: string; clicks: number }>();

    linksWithUTM.forEach((link) => {
      const clickCount = link.clicks.length;

      // Campaign breakdown
      if (link.utmCampaign) {
        campaignMap.set(
          link.utmCampaign,
          (campaignMap.get(link.utmCampaign) || 0) + clickCount
        );
      }

      // Source breakdown
      if (link.utmSource) {
        sourceMap.set(
          link.utmSource,
          (sourceMap.get(link.utmSource) || 0) + clickCount
        );
      }

      // Medium breakdown
      if (link.utmMedium) {
        mediumMap.set(
          link.utmMedium,
          (mediumMap.get(link.utmMedium) || 0) + clickCount
        );
      }

      // Campaign × Source
      if (link.utmCampaign && link.utmSource) {
        const key = `${link.utmCampaign}|${link.utmSource}`;
        const existing = campaignSourceMap.get(key);
        if (existing) {
          existing.clicks += clickCount;
        } else {
          campaignSourceMap.set(key, {
            campaign: link.utmCampaign,
            source: link.utmSource,
            clicks: clickCount,
          });
        }
      }

      // Campaign × Content
      if (link.utmCampaign && link.utmContent) {
        const key = `${link.utmCampaign}|${link.utmContent}`;
        const existing = campaignContentMap.get(key);
        if (existing) {
          existing.clicks += clickCount;
        } else {
          campaignContentMap.set(key, {
            campaign: link.utmCampaign,
            content: link.utmContent,
            clicks: clickCount,
          });
        }
      }
    });

    // Convert maps to sorted arrays
    const utmCampaigns = Array.from(campaignMap.entries())
      .map(([name, clicks]) => ({ name, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);

    const utmSources = Array.from(sourceMap.entries())
      .map(([name, clicks]) => ({ name, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);

    const utmMediums = Array.from(mediumMap.entries())
      .map(([name, clicks]) => ({ name, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);

    const utmCampaignSource = Array.from(campaignSourceMap.values())
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 15);

    const utmCampaignContent = Array.from(campaignContentMap.values())
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 15);

    return NextResponse.json({
      summary: {
        totalClicks,
        uniqueVisitors: uniqueVisitors.length,
        clicksChange: 0, // TODO: Calculate compared to previous period
      },
      clicksByDay: clicksByDay.map((d) => ({
        date: d.date,
        clicks: d.count,
      })),
      devices: deviceStats.map((d) => ({
        name: d.device || "Unknown",
        value: d._count,
      })),
      browsers: browserStats.map((b) => ({
        name: b.browser || "Unknown",
        value: b._count,
      })),
      operatingSystems: osStats.map((o) => ({
        name: o.os || "Unknown",
        value: o._count,
      })),
      referrers: referrerStats.map((r) => ({
        name: r.referrer || "Direct",
        value: r._count,
      })),
      countries: countryStats.map((c) => ({
        name: c.country || "Unknown",
        value: c._count,
      })),
      topLinks: topLinks.map((l) => ({
        id: l.id,
        code: l.code,
        title: l.title,
        originalUrl: l.originalUrl,
        clicks: l._count.clicks,
      })),
      // UTM Analytics
      utm: {
        campaigns: utmCampaigns,
        sources: utmSources,
        mediums: utmMediums,
        campaignSource: utmCampaignSource,
        campaignContent: utmCampaignContent,
      },
    });
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
