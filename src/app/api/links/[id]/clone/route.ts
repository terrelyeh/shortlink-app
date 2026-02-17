import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createShortCode } from "@/lib/utils/shortcode";

// POST - Clone an existing link
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get the source link
    const sourceLink = await prisma.shortLink.findUnique({
      where: { id },
      include: { tags: true },
    });

    if (!sourceLink) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    // Check permission
    if (session.user.role === "MEMBER" && sourceLink.createdById !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Generate new unique code
    let code: string;
    let attempts = 0;
    do {
      code = createShortCode();
      const existing = await prisma.shortLink.findUnique({ where: { code } });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return NextResponse.json(
        { error: "Failed to generate unique code" },
        { status: 500 }
      );
    }

    // Clone the link
    const clonedLink = await prisma.shortLink.create({
      data: {
        code,
        originalUrl: sourceLink.originalUrl,
        title: sourceLink.title ? `${sourceLink.title} (copy)` : null,
        description: sourceLink.description,
        redirectType: sourceLink.redirectType,
        status: "ACTIVE",
        utmSource: sourceLink.utmSource,
        utmMedium: sourceLink.utmMedium,
        utmCampaign: sourceLink.utmCampaign,
        utmContent: sourceLink.utmContent,
        utmTerm: sourceLink.utmTerm,
        expiresAt: sourceLink.expiresAt,
        maxClicks: sourceLink.maxClicks,
        workspaceId: sourceLink.workspaceId,
        createdById: session.user.id,
        groupId: sourceLink.groupId,
        campaignId: sourceLink.campaignId,
        // Clone tags
        ...(sourceLink.tags.length > 0 && {
          tags: {
            create: sourceLink.tags.map((t: { tagId: string }) => ({
              tag: { connect: { id: t.tagId } },
            })),
          },
        }),
      },
      include: {
        tags: { include: { tag: true } },
        _count: { select: { clicks: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_LINK",
        targetId: clonedLink.id,
        metadata: { clonedFrom: id, code: clonedLink.code },
      },
    });

    return NextResponse.json(clonedLink, { status: 201 });
  } catch (error) {
    console.error("Failed to clone link:", error);
    return NextResponse.json({ error: "Failed to clone link" }, { status: 500 });
  }
}
