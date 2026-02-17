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

    const now = new Date();
    let startDate: Date;
    switch (range) {
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

    const whereClicks: Record<string, unknown> = {
      timestamp: { gte: startDate },
    };

    if (linkId) {
      whereClicks.shortLinkId = linkId;
    } else {
      const whereLinks: Record<string, unknown> = { deletedAt: null };
      if (session.user.role === "MEMBER") {
        whereLinks.createdById = session.user.id;
      }
      const userLinks = await prisma.shortLink.findMany({
        where: whereLinks,
        select: { id: true },
      });
      whereClicks.shortLinkId = { in: userLinks.map((l: { id: string }) => l.id) };
    }

    const clicks = await prisma.click.findMany({
      where: whereClicks,
      include: {
        shortLink: { select: { code: true, title: true, originalUrl: true } },
      },
      orderBy: { timestamp: "desc" },
    });

    const headers = [
      "Timestamp", "Link Code", "Link Title", "Original URL",
      "Device", "Browser", "OS", "Referrer", "Country", "City",
    ];

    type ClickRow = {
      timestamp: Date;
      shortLink: { code: string; title: string | null; originalUrl: string };
      device: string | null;
      browser: string | null;
      os: string | null;
      referrer: string | null;
      country: string | null;
      city: string | null;
    };

    const rows = clicks.map((c: ClickRow) => [
      c.timestamp.toISOString(),
      c.shortLink.code,
      csvEscape(c.shortLink.title || ""),
      csvEscape(c.shortLink.originalUrl),
      c.device || "unknown",
      c.browser || "unknown",
      c.os || "unknown",
      csvEscape(c.referrer || ""),
      c.country || "",
      c.city || "",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="analytics-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Failed to export analytics:", error);
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
