import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateLinkSchema = z.object({
  originalUrl: z.string().url().optional(),
  title: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
  redirectType: z.enum(["PERMANENT", "TEMPORARY"]).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  maxClicks: z.number().int().positive().optional().nullable(),
  utmSource: z.string().optional().nullable(),
  utmMedium: z.string().optional().nullable(),
  utmCampaign: z.string().optional().nullable(),
  utmContent: z.string().optional().nullable(),
  utmTerm: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(), // Array of tag IDs
});

// GET - Get single link
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const link = await prisma.shortLink.findUnique({
      where: { id },
      include: {
        _count: { select: { clicks: true } },
        tags: { include: { tag: true } },
      },
    });

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    // Check access
    if (session.user.role === "MEMBER" && link.createdById !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json(link);
  } catch (error) {
    console.error("Failed to fetch link:", error);
    return NextResponse.json({ error: "Failed to fetch link" }, { status: 500 });
  }
}

// PATCH - Update link
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validated = updateLinkSchema.parse(body);

    // Get existing link
    const existingLink = await prisma.shortLink.findUnique({
      where: { id },
    });

    if (!existingLink) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    // Check permission
    if (
      session.user.role === "MEMBER" &&
      existingLink.createdById !== session.user.id
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (validated.originalUrl) updateData.originalUrl = validated.originalUrl;
    if (validated.title !== undefined) updateData.title = validated.title;
    if (validated.status) updateData.status = validated.status;
    if (validated.redirectType) updateData.redirectType = validated.redirectType;
    if (validated.expiresAt !== undefined) {
      updateData.expiresAt = validated.expiresAt ? new Date(validated.expiresAt) : null;
    }
    if (validated.maxClicks !== undefined) updateData.maxClicks = validated.maxClicks;

    // UTM fields
    if (validated.utmSource !== undefined) updateData.utmSource = validated.utmSource;
    if (validated.utmMedium !== undefined) updateData.utmMedium = validated.utmMedium;
    if (validated.utmCampaign !== undefined) updateData.utmCampaign = validated.utmCampaign;
    if (validated.utmContent !== undefined) updateData.utmContent = validated.utmContent;
    if (validated.utmTerm !== undefined) updateData.utmTerm = validated.utmTerm;

    // If UTM params changed, rebuild the originalUrl with updated UTM query params
    const utmChanged = ["utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm"]
      .some((key) => (validated as Record<string, unknown>)[key] !== undefined);

    if (utmChanged) {
      const baseUrl = validated.originalUrl || existingLink.originalUrl;
      const url = new URL(baseUrl);

      // Merge: use validated value if provided, else keep existing
      const utmSource = validated.utmSource !== undefined ? validated.utmSource : existingLink.utmSource;
      const utmMedium = validated.utmMedium !== undefined ? validated.utmMedium : existingLink.utmMedium;
      const utmCampaign = validated.utmCampaign !== undefined ? validated.utmCampaign : existingLink.utmCampaign;
      const utmContent = validated.utmContent !== undefined ? validated.utmContent : existingLink.utmContent;
      const utmTerm = validated.utmTerm !== undefined ? validated.utmTerm : existingLink.utmTerm;

      // Remove old UTM params, then set new ones
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(
        (p) => url.searchParams.delete(p)
      );
      if (utmSource) url.searchParams.set("utm_source", utmSource);
      if (utmMedium) url.searchParams.set("utm_medium", utmMedium);
      if (utmCampaign) url.searchParams.set("utm_campaign", utmCampaign);
      if (utmContent) url.searchParams.set("utm_content", utmContent);
      if (utmTerm) url.searchParams.set("utm_term", utmTerm);

      updateData.originalUrl = url.toString();
    }

    // Update the link
    const updatedLink = await prisma.shortLink.update({
      where: { id },
      data: updateData,
    });

    // Update tags if provided (replace all)
    if (validated.tags !== undefined) {
      // Remove all existing tag associations
      await prisma.tagOnLink.deleteMany({ where: { shortLinkId: id } });

      // Create new tag associations
      if (validated.tags.length > 0) {
        await prisma.tagOnLink.createMany({
          data: validated.tags.map((tagId) => ({
            shortLinkId: id,
            tagId,
          })),
        });
      }
    }

    // Re-fetch with tags included
    const result = await prisma.shortLink.findUnique({
      where: { id },
      include: {
        _count: { select: { clicks: true } },
        tags: { include: { tag: true } },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE_LINK",
        targetId: id,
        metadata: { changes: validated },
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Failed to update link:", error);
    return NextResponse.json({ error: "Failed to update link" }, { status: 500 });
  }
}

// DELETE - Soft delete link
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get existing link
    const existingLink = await prisma.shortLink.findUnique({
      where: { id },
    });

    if (!existingLink) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    // Check permission
    if (
      session.user.role === "MEMBER" &&
      existingLink.createdById !== session.user.id
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Soft delete
    await prisma.shortLink.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE_LINK",
        targetId: id,
        metadata: { code: existingLink.code },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete link:", error);
    return NextResponse.json({ error: "Failed to delete link" }, { status: 500 });
  }
}
