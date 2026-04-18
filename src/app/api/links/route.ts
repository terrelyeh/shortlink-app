import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createShortCode, isValidCustomCode, isReservedCode } from "@/lib/utils/shortcode";
import { resolveWorkspaceScope } from "@/lib/workspace";
import { cacheGetVersion, cacheKey, cached } from "@/lib/cache";
import { bumpLinksCache, linksCacheNamespace } from "@/lib/cache-scopes";
import {
  getWorkspaceUtmGovernance,
  validateUtmAgainstGovernance,
} from "@/lib/utm-governance";
import { fetchOpenGraph } from "@/lib/og-scraper";
import { z } from "zod";

/**
 * Fire-and-forget-but-guaranteed OG metadata fetch. Uses Next's `after()`
 * API so the link-create response ships before the scrape starts; the
 * scrape itself happens on the same Lambda invocation so it *will*
 * complete (unlike a naked fire-and-forget which Vercel would kill).
 */
async function populateOgMetadata(linkId: string, url: string, workspaceId: string | null, userId: string) {
  try {
    const og = await fetchOpenGraph(url);
    if (!og) return;
    await prisma.shortLink.update({
      where: { id: linkId },
      data: {
        ogImage: og.image,
        ogTitle: og.title,
        ogDescription: og.description,
        ogFetchedAt: new Date(),
      },
    });
    await bumpLinksCache(workspaceId, userId);
  } catch (err) {
    console.warn("[og] populate failed for", linkId, err);
  }
}

// Validation schema
const createLinkSchema = z.object({
  originalUrl: z.string().url("Invalid URL"),
  customCode: z.string().optional(),
  title: z.string().optional(),
  redirectType: z.enum(["PERMANENT", "TEMPORARY"]).default("TEMPORARY"),
  startsAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  maxClicks: z.number().int().positive().optional().nullable(),
  allowedCountries: z
    .array(z.string().regex(/^[A-Z]{2}$/, "Use ISO 3166-1 alpha-2 codes (e.g. TW, US)"))
    .max(50)
    .optional(),
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
    const tagId = searchParams.get("tagId");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const scope = await resolveWorkspaceScope(request, session);
    if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const where: Record<string, unknown> = {
      deletedAt: null,
      ...scope.where,
    };

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
      if (campaign === "__none__") {
        where.utmCampaign = null;
      } else {
        where.utmCampaign = campaign;
      }
    }

    // Filter by tag
    if (tagId) {
      where.tags = { some: { tagId } };
    }

    // Redis cache wraps the whole query + trend groupBys. Key includes
    // workspace/user scope + all filter params + a versioned counter that
    // gets bumped on any write (POST/PATCH/DELETE under /api/links/*).
    const ns = linksCacheNamespace(scope.workspaceId, session.user.id);
    const version = await cacheGetVersion(ns);
    const key = cacheKey(
      "links-list",
      ns,
      version,
      page,
      limit,
      search,
      status ?? "_",
      campaign ?? "_",
      tagId ?? "_",
      sortBy,
      sortOrder,
    );

    const payload = await cached(key, 30, async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const [links, total] = await Promise.all([
        prisma.shortLink.findMany({
          where,
          include: {
            _count: { select: { clicks: true } },
            tags: { include: { tag: true } },
          },
          orderBy: sortBy === "clicks"
            ? { clicks: { _count: sortOrder as "asc" | "desc" } }
            : { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.shortLink.count({ where }),
      ]);

      const linkIds = links.map((l: { id: string }) => l.id);
      const [clicks7d, clicksPrev7d] = linkIds.length > 0
        ? await Promise.all([
          prisma.click.groupBy({
            by: ["shortLinkId"],
            where: { shortLinkId: { in: linkIds }, timestamp: { gte: sevenDaysAgo } },
            _count: { _all: true },
          }),
          prisma.click.groupBy({
            by: ["shortLinkId"],
            where: { shortLinkId: { in: linkIds }, timestamp: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
            _count: { _all: true },
          }),
        ])
        : [[], []];

      const clicks7dMap = new Map((clicks7d as { shortLinkId: string; _count: { _all: number } }[]).map((r) => [r.shortLinkId, r._count._all]));
      const clicksPrev7dMap = new Map((clicksPrev7d as { shortLinkId: string; _count: { _all: number } }[]).map((r) => [r.shortLinkId, r._count._all]));

      const enrichedLinks = links.map((link: { id: string }) => {
        const c7 = clicks7dMap.get(link.id) ?? 0;
        const cp = clicksPrev7dMap.get(link.id) ?? 0;
        const trendPct = cp > 0 ? Math.round(((c7 - cp) / cp) * 100) : null;
        return { ...link, clicksLast7d: c7, trendPct };
      });

      return {
        links: enrichedLinks,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
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

    // Resolve workspace scope up-front — we need it for governance checks
    // and the final create. Fails fast on cross-workspace attempts.
    const scope = await resolveWorkspaceScope(request, session);
    if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

    // If campaignId is provided, fetch Campaign entity and auto-fill UTM values
    let utmSource = validated.utmSource;
    let utmMedium = validated.utmMedium;
    let utmCampaign = validated.utmCampaign;
    const utmContent = validated.utmContent;
    const utmTerm = validated.utmTerm;

    if (validated.campaignId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: validated.campaignId },
        select: { name: true, defaultSource: true, defaultMedium: true },
      });
      if (campaign) {
        // Campaign.name → utmCampaign (always sync)
        utmCampaign = campaign.name;
        // Use campaign defaults only if not explicitly provided
        if (!utmSource && campaign.defaultSource) utmSource = campaign.defaultSource;
        if (!utmMedium && campaign.defaultMedium) utmMedium = campaign.defaultMedium;
      }
    }

    // Governance: enforce workspace-level UTM whitelist if configured.
    // Runs *after* Campaign auto-fill so campaign defaults are also checked.
    const governance = await getWorkspaceUtmGovernance(scope.workspaceId);
    const govErrors = validateUtmAgainstGovernance(governance, {
      source: utmSource,
      medium: utmMedium,
    });
    if (govErrors.length > 0) {
      return NextResponse.json(
        { error: "UTM governance violation", details: govErrors },
        { status: 400 },
      );
    }

    // Build final URL with UTM parameters
    let finalUrl = validated.originalUrl;
    if (utmSource || utmMedium || utmCampaign) {
      const url = new URL(validated.originalUrl);
      if (utmSource) url.searchParams.set("utm_source", utmSource);
      if (utmMedium) url.searchParams.set("utm_medium", utmMedium);
      if (utmCampaign) url.searchParams.set("utm_campaign", utmCampaign);
      if (utmContent) url.searchParams.set("utm_content", utmContent);
      if (utmTerm) url.searchParams.set("utm_term", utmTerm);
      finalUrl = url.toString();
    }

    // Create the short link with tags
    const workspaceId = scope.workspaceId;
    const shortLink = await prisma.shortLink.create({
      data: {
        code: code!,
        originalUrl: finalUrl,
        title: validated.title,
        redirectType: validated.redirectType,
        startsAt: validated.startsAt ? new Date(validated.startsAt) : null,
        expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
        maxClicks: validated.maxClicks,
        allowedCountries: validated.allowedCountries ?? [],
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        createdById: session.user.id,
        workspaceId: workspaceId || undefined,
        groupId: validated.groupId,
        campaignId: validated.campaignId,
        ...(validated.tags && validated.tags.length > 0 && {
          tags: {
            create: validated.tags.map((tagId) => ({
              tag: { connect: { id: tagId } },
            })),
          },
        }),
      },
      include: {
        tags: { include: { tag: true } },
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

    await bumpLinksCache(workspaceId, session.user.id);

    // Kick off OG metadata fetch after the response — best-effort, does not
    // block link creation. Uses the *destination* URL (without UTM params)
    // so thumbnails aren't keyed by tracking variants.
    after(() => populateOgMetadata(shortLink.id, validated.originalUrl, workspaceId, session.user.id));

    return NextResponse.json(shortLink, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Failed to create link:", error);
    return NextResponse.json({ error: "Failed to create link" }, { status: 500 });
  }
}
