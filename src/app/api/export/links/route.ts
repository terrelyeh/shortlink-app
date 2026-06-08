import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceScope } from "@/lib/workspace";
import { buildCsv, csvResponse } from "@/lib/utils/csv";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    // Default excludes test clicks so the exported "Clicks" column
    // matches the real-traffic number shown on the /links page.
    const includeInternal = searchParams.get("includeInternal") === "1";

    const scope = await resolveWorkspaceScope(request, session);
    if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const where: Record<string, unknown> = { deletedAt: null, ...scope.where };
    if (status) where.status = status;

    const links = await prisma.shortLink.findMany({
      where,
      include: {
        _count: {
          select: {
            clicks: includeInternal ? true : { where: { isInternal: false } },
          },
        },
        tags: { include: { tag: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const shortBaseUrl = process.env.NEXT_PUBLIC_SHORT_URL || "http://localhost:3000/s";

    const headers = [
      "Title", "Short URL", "Original URL", "Status", "Clicks",
      "UTM Source", "UTM Medium", "UTM Campaign", "UTM Content", "UTM Term",
      "Tags", "Created At", "Expires At",
    ];

    const rows = links.map((link) => [
      link.title || "",
      `${shortBaseUrl}/${link.code}`,
      link.originalUrl,
      link.status,
      link._count.clicks,
      link.utmSource || "",
      link.utmMedium || "",
      link.utmCampaign || "",
      link.utmContent || "",
      link.utmTerm || "",
      link.tags.map((t: { tag: { name: string } }) => t.tag.name).join(", "),
      link.createdAt.toISOString(),
      link.expiresAt?.toISOString() || "",
    ]);

    const today = new Date().toISOString().split("T")[0];
    return csvResponse(buildCsv(headers, rows), `links-export-${today}.csv`);
  } catch (error) {
    console.error("Failed to export links:", error);
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}
