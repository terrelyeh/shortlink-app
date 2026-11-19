import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceScope } from "@/lib/workspace";
import { buildCsv, csvResponse } from "@/lib/utils/csv";
import { countedClickWhere } from "@/lib/click-quality";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    // Mirrors whatever the /analytics page is showing: range (incl. "all"
    // and custom from/to), campaign, tag and link filters. Previously only
    // range + link were read, so a filtered view exported everything.
    const range = searchParams.get("range") || "7d";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const linkId = searchParams.get("linkId");
    const campaign = searchParams.get("campaign");
    const tagId = searchParams.get("tagId");
    // Default excludes test clicks to match the /analytics page.
    const includeInternal = searchParams.get("includeInternal") === "1";

    const now = new Date();
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    switch (range) {
      case "all":
        startDate = undefined;
        break;
      case "custom": {
        const f = from ? new Date(from) : null;
        const tt = to ? new Date(to) : null;
        startDate = f && !isNaN(f.getTime()) ? f : undefined;
        // from / to are ISO timestamps computed in the viewer's browser,
        // so "custom" matches the on-screen window in the viewer's timezone.
        if (tt && !isNaN(tt.getTime())) endDate = tt;
        break;
      }
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
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

    // Always resolve workspace scope first — even when a linkId is given —
    // so a user can't export another workspace's click logs by guessing
    // an id (IDOR). The linkId is then constrained to ids within scope.
    const scope = await resolveWorkspaceScope(request, session);
    if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const userLinks = await prisma.shortLink.findMany({
      where: {
        deletedAt: null,
        ...scope.where,
        ...(campaign === "__none__" ? { utmCampaign: null } : campaign ? { utmCampaign: campaign } : {}),
        ...(tagId ? { tags: { some: { tagId } } } : {}),
      },
      select: { id: true },
    });
    const scopedLinkIds = userLinks.map((l) => l.id);

    let targetLinkIds: string[];
    if (linkId) {
      // Only honor the requested link if it's within the caller's scope.
      if (!scopedLinkIds.includes(linkId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      targetLinkIds = [linkId];
    } else {
      targetLinkIds = scopedLinkIds;
    }

    const whereClicks: Record<string, unknown> = {
      ...(startDate || endDate
        ? { timestamp: { ...(startDate && { gte: startDate }), ...(endDate && { lte: endDate }) } }
        : {}),
      shortLinkId: { in: targetLinkIds },
      ...countedClickWhere(includeInternal),
    };

    const clicks = await prisma.click.findMany({
      where: whereClicks,
      include: {
        shortLink: {
          select: {
            code: true,
            title: true,
            originalUrl: true,
            utmCampaign: true,
            utmSource: true,
            utmMedium: true,
            utmContent: true,
          },
        },
      },
      orderBy: { timestamp: "desc" },
    });

    const headers = [
      "Timestamp", "Link Code", "Link Title", "Original URL",
      "UTM Campaign", "UTM Source", "UTM Medium", "UTM Content",
      "Device", "Browser", "OS", "Referrer", "Country", "City",
    ];

    type ClickRow = {
      timestamp: Date;
      shortLink: {
        code: string;
        title: string | null;
        originalUrl: string;
        utmCampaign: string | null;
        utmSource: string | null;
        utmMedium: string | null;
        utmContent: string | null;
      };
      device: string | null;
      browser: string | null;
      os: string | null;
      referrer: string | null;
      country: string | null;
      city: string | null;
    };

    const rows = (clicks as ClickRow[]).map((c) => [
      c.timestamp.toISOString(),
      c.shortLink.code,
      c.shortLink.title || "",
      c.shortLink.originalUrl,
      c.shortLink.utmCampaign || "",
      c.shortLink.utmSource || "",
      c.shortLink.utmMedium || "",
      c.shortLink.utmContent || "",
      c.device || "unknown",
      c.browser || "unknown",
      c.os || "unknown",
      c.referrer || "",
      c.country || "",
      c.city || "",
    ]);

    const today = new Date().toISOString().split("T")[0];
    return csvResponse(buildCsv(headers, rows), `analytics-export-${today}.csv`);
  } catch (error) {
    console.error("Failed to export analytics:", error);
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}
