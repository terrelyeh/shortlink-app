import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const campaignSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-z0-9_-]+$/, "Name must be lowercase with underscores/hyphens only"),
  displayName: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  defaultSource: z.string().optional(),
  defaultMedium: z.string().optional(),
  tags: z.array(z.string()).optional(), // Tag names
});

// GET - List campaigns
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const tagId = searchParams.get("tagId");
    const includeArchived = searchParams.get("includeArchived") === "true";

    // Build where clause
    const where: Record<string, unknown> = {};

    // Role-based filtering
    if (session.user.role === "MEMBER") {
      where.createdById = session.user.id;
    }

    // Status filter
    if (status) {
      where.status = status;
    } else if (!includeArchived) {
      where.status = { not: "ARCHIVED" };
    }

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { displayName: { contains: search, mode: "insensitive" } },
      ];
    }

    // Tag filter
    if (tagId) {
      where.tags = {
        some: { tagId },
      };
    }

    const campaigns = await prisma.campaign.findMany({
      where,
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
      orderBy: { createdAt: "desc" },
    });

    // Get all available tags
    const allTags = await prisma.campaignTag.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      campaigns: campaigns.map((c: { id: string; name: string; description: string | null; createdAt: Date; tags: { tag: { id: string; name: string } }[]; _count: { links: number } }) => ({
        ...c,
        tags: c.tags.map((t: { tag: { id: string; name: string } }) => t.tag),
        linkCount: c._count.links,
      })),
      tags: allTags,
    });
  } catch (error) {
    console.error("Failed to fetch campaigns:", error);
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
}

// POST - Create campaign
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = campaignSchema.parse(body);

    // Check if campaign name already exists for this user
    const existing = await prisma.campaign.findFirst({
      where: {
        name: validated.name,
        createdById: session.user.id,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Campaign with this name already exists" },
        { status: 409 }
      );
    }

    // Handle tags - create if not exists
    let tagConnections: { tagId: string }[] = [];
    if (validated.tags && validated.tags.length > 0) {
      const tagPromises = validated.tags.map(async (tagName) => {
        const tag = await prisma.campaignTag.upsert({
          where: { name: tagName },
          update: {},
          create: { name: tagName },
        });
        return { tagId: tag.id };
      });
      tagConnections = await Promise.all(tagPromises);
    }

    const campaign = await prisma.campaign.create({
      data: {
        name: validated.name,
        displayName: validated.displayName,
        description: validated.description,
        status: validated.status || "ACTIVE",
        startDate: validated.startDate ? new Date(validated.startDate) : null,
        endDate: validated.endDate ? new Date(validated.endDate) : null,
        defaultSource: validated.defaultSource,
        defaultMedium: validated.defaultMedium,
        createdById: session.user.id,
        tags: {
          create: tagConnections,
        },
      },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_CAMPAIGN",
        targetId: campaign.id,
        metadata: { name: campaign.name },
      },
    });

    return NextResponse.json(
      {
        ...campaign,
        tags: campaign.tags.map((t: { tag: { id: string; name: string } }) => t.tag),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Failed to create campaign:", error);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}
