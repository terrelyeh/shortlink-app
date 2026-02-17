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
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { deletedAt: null };

    if (session.user.role === "MEMBER") {
      where.createdById = session.user.id;
    }
    if (status) where.status = status;

    const links = await prisma.shortLink.findMany({
      where,
      include: {
        _count: { select: { clicks: true } },
        tags: { include: { tag: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const shortBaseUrl = process.env.NEXT_PUBLIC_SHORT_URL || "http://localhost:3000/s";

    // Build CSV
    const headers = [
      "Title", "Short URL", "Original URL", "Status", "Clicks",
      "UTM Source", "UTM Medium", "UTM Campaign", "UTM Content", "UTM Term",
      "Tags", "Created At", "Expires At",
    ];

    const rows = links.map((link) => [
      csvEscape(link.title || ""),
      csvEscape(`${shortBaseUrl}/${link.code}`),
      csvEscape(link.originalUrl),
      link.status,
      link._count.clicks.toString(),
      csvEscape(link.utmSource || ""),
      csvEscape(link.utmMedium || ""),
      csvEscape(link.utmCampaign || ""),
      csvEscape(link.utmContent || ""),
      csvEscape(link.utmTerm || ""),
      csvEscape(link.tags.map((t: { tag: { name: string } }) => t.tag.name).join(", ")),
      link.createdAt.toISOString(),
      link.expiresAt?.toISOString() || "",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="links-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Failed to export links:", error);
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
