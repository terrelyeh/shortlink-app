import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createShortCode, isValidCustomCode, isReservedCode } from "@/lib/utils/shortcode";
import { z } from "zod";

// Validation schema
const createLinkSchema = z.object({
  originalUrl: z.string().url("Invalid URL"),
  customCode: z.string().optional(),
  title: z.string().optional(),
  redirectType: z.enum(["PERMANENT", "TEMPORARY"]).default("TEMPORARY"),
  expiresAt: z.string().datetime().optional().nullable(),
  maxClicks: z.number().int().positive().optional().nullable(),
  campaignId: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
  utmTerm: z.string().optional(),
  groupId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// GET - List links
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");
    const campaign = searchParams.get("campaign");

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    // Members can only see their own links
    if (session.user.role === "MEMBER") {
      where.createdById = session.user.id;
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { originalUrl: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status;
    }

    // Filter by utm_campaign
    if (campaign) {
      where.utmCampaign = campaign;
    }

    const [links, total] = await Promise.all([
      prisma.shortLink.findMany({
        where,
        include: {
          _count: { select: { clicks: true } },
          tags: { include: { tag: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.shortLink.count({ where }),
    ]);

    return NextResponse.json({
      links,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch links:", error);
    return NextResponse.json({ error: "Failed to fetch links" }, { status: 500 });
  }
}

// POST - Create link
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = createLinkSchema.parse(body);

    // Generate or validate code
    let code = validated.customCode;

    if (code) {
      // Validate custom code
      if (!isValidCustomCode(code)) {
        return NextResponse.json(
          { error: "Invalid custom code format. Use 3-50 alphanumeric characters, hyphens, or underscores." },
          { status: 400 }
        );
      }

      if (isReservedCode(code)) {
        return NextResponse.json(
          { error: "This code is reserved and cannot be used." },
          { status: 400 }
        );
      }

      // Check if code exists
      const existing = await prisma.shortLink.findUnique({ where: { code } });
      if (existing) {
        return NextResponse.json(
          { error: "This code is already in use." },
          { status: 400 }
        );
      }
    } else {
      // Generate unique code
      let attempts = 0;
      do {
        code = createShortCode();
        const existing = await prisma.shortLink.findUnique({ where: { code } });
        if (!existing) break;
        attempts++;
      } while (attempts < 10);

      if (attempts >= 10) {
        return NextResponse.json(
          { error: "Failed to generate unique code. Please try again." },
          { status: 500 }
        );
      }
    }

    // Build final URL with UTM parameters
    let finalUrl = validated.originalUrl;
    if (validated.utmSource || validated.utmMedium || validated.utmCampaign) {
      const url = new URL(validated.originalUrl);
      if (validated.utmSource) url.searchParams.set("utm_source", validated.utmSource);
      if (validated.utmMedium) url.searchParams.set("utm_medium", validated.utmMedium);
      if (validated.utmCampaign) url.searchParams.set("utm_campaign", validated.utmCampaign);
      if (validated.utmContent) url.searchParams.set("utm_content", validated.utmContent);
      if (validated.utmTerm) url.searchParams.set("utm_term", validated.utmTerm);
      finalUrl = url.toString();
    }

    // Create the short link
    const shortLink = await prisma.shortLink.create({
      data: {
        code: code!,
        originalUrl: finalUrl,
        title: validated.title,
        redirectType: validated.redirectType,
        expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
        maxClicks: validated.maxClicks,
        utmSource: validated.utmSource,
        utmMedium: validated.utmMedium,
        utmCampaign: validated.utmCampaign,
        utmContent: validated.utmContent,
        utmTerm: validated.utmTerm,
        createdById: session.user.id,
        groupId: validated.groupId,
        campaignId: validated.campaignId,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_LINK",
        targetId: shortLink.id,
        metadata: { code: shortLink.code, originalUrl: shortLink.originalUrl },
      },
    });

    return NextResponse.json(shortLink, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Failed to create link:", error);
    return NextResponse.json({ error: "Failed to create link" }, { status: 500 });
  }
}
