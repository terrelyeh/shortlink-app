import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateCampaignSchema = z.object({
  name: z.string().min(1).regex(/^[a-z0-9_-]+$/).optional(),
  displayName: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  defaultSource: z.string().optional().nullable(),
  defaultMedium: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
});

// GET - Get single campaign
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

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        links: {
          where: { deletedAt: null },
          select: {
            id: true,
            code: true,
            title: true,
            originalUrl: true,
            utmSource: true,
            utmMedium: true,
            utmContent: true,
            _count: {
              select: { clicks: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: { links: true },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Check access
    if (session.user.role === "MEMBER" && campaign.createdById !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      ...campaign,
      tags: campaign.tags.map((t: { tag: { id: string; name: string } }) => t.tag),
      links: campaign.links.map((l: { id: string; code: string; originalUrl: string; title: string | null; _count: { clicks: number } }) => ({
        ...l,
        clicks: l._count.clicks,
      })),
      linkCount: campaign._count.links,
    });
  } catch (error) {
    console.error("Failed to fetch campaign:", error);
    return NextResponse.json({ error: "Failed to fetch campaign" }, { status: 500 });
  }
}

// PATCH - Update campaign
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
    const validated = updateCampaignSchema.parse(body);

    // Check if campaign exists and user has access
    const existing = await prisma.campaign.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (session.user.role === "MEMBER" && existing.createdById !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // If name is being changed, check for duplicates
    if (validated.name && validated.name !== existing.name) {
      const duplicate = await prisma.campaign.findFirst({
        where: {
          name: validated.name,
          createdById: existing.createdById,
          id: { not: id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "Campaign with this name already exists" },
          { status: 409 }
        );
      }
    }

    // Handle tags update
    if (validated.tags !== undefined) {
      // Delete existing tag connections
      await prisma.tagOnCampaign.deleteMany({
        where: { campaignId: id },
      });

      // Create new tag connections
      if (validated.tags.length > 0) {
        for (const tagName of validated.tags) {
          const tag = await prisma.campaignTag.upsert({
            where: { name: tagName },
            update: {},
            create: { name: tagName },
          });
          await prisma.tagOnCampaign.create({
            data: {
              campaignId: id,
              tagId: tag.id,
            },
          });
        }
      }
    }

    // Build update data (excluding tags which are handled separately)
    const { tags: _tags, ...updateData } = validated;
    const updatePayload: Record<string, unknown> = {};

    if (updateData.name !== undefined) updatePayload.name = updateData.name;
    if (updateData.displayName !== undefined) updatePayload.displayName = updateData.displayName;
    if (updateData.description !== undefined) updatePayload.description = updateData.description;
    if (updateData.status !== undefined) updatePayload.status = updateData.status;
    if (updateData.startDate !== undefined) {
      updatePayload.startDate = updateData.startDate ? new Date(updateData.startDate) : null;
    }
    if (updateData.endDate !== undefined) {
      updatePayload.endDate = updateData.endDate ? new Date(updateData.endDate) : null;
    }
    if (updateData.defaultSource !== undefined) updatePayload.defaultSource = updateData.defaultSource;
    if (updateData.defaultMedium !== undefined) updatePayload.defaultMedium = updateData.defaultMedium;

    const campaign = await prisma.campaign.update({
      where: { id },
      data: updatePayload,
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        _count: {
          select: { links: true },
        },
      },
    });

    // If campaign name changed, optionally update linked ShortLinks' utmCampaign
    if (validated.name && validated.name !== existing.name) {
      await prisma.shortLink.updateMany({
        where: {
          campaignId: id,
          utmCampaign: existing.name,
        },
        data: {
          utmCampaign: validated.name,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE_CAMPAIGN",
        targetId: campaign.id,
        metadata: { name: campaign.name, changes: Object.keys(validated) },
      },
    });

    return NextResponse.json({
      ...campaign,
      tags: campaign.tags.map((t: { tag: { id: string; name: string } }) => t.tag),
      linkCount: campaign._count.links,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Failed to update campaign:", error);
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}

// DELETE - Delete campaign
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

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        _count: {
          select: { links: true },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (session.user.role === "MEMBER" && campaign.createdById !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Unlink all links from this campaign (don't delete the links)
    await prisma.shortLink.updateMany({
      where: { campaignId: id },
      data: { campaignId: null },
    });

    // Delete the campaign
    await prisma.campaign.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE_CAMPAIGN",
        targetId: id,
        metadata: { name: campaign.name, linkCount: campaign._count.links },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete campaign:", error);
    return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 });
  }
}
