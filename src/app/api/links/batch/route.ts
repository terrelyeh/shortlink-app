import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createShortCode } from "@/lib/utils/shortcode";
import { bumpLinksCache } from "@/lib/cache-scopes";
import { resolveWorkspaceScope } from "@/lib/workspace";
import {
  getWorkspaceUtmGovernance,
  validateUtmAgainstGovernance,
} from "@/lib/utm-governance";
import { z } from "zod";

const batchCreateSchema = z.object({
  originalUrl: z.string().url("Invalid URL"),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  // Array of content values (e.g., KOL names)
  contents: z.array(z.string().min(1)).min(1).max(100),
  redirectType: z.enum(["PERMANENT", "TEMPORARY"]).default("TEMPORARY"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = batchCreateSchema.parse(body);

    // Resolve workspace scope (fallback to user scope for legacy batch mode).
    const scope = await resolveWorkspaceScope(request, session);
    if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Governance check once upfront — all rows share the same source/medium.
    const governance = await getWorkspaceUtmGovernance(scope.workspaceId);
    const govErrors = validateUtmAgainstGovernance(governance, {
      source: validated.utmSource,
      medium: validated.utmMedium,
    });
    if (govErrors.length > 0) {
      return NextResponse.json(
        { error: "UTM governance violation", details: govErrors },
        { status: 400 },
      );
    }

    const createdLinks = [];
    const errors = [];

    for (const content of validated.contents) {
      try {
        // Generate unique code
        let code: string;
        let attempts = 0;
        do {
          code = createShortCode();
          const existing = await prisma.shortLink.findUnique({ where: { code } });
          if (!existing) break;
          attempts++;
        } while (attempts < 10);

        if (attempts >= 10) {
          errors.push({ content, error: "Failed to generate unique code" });
          continue;
        }

        // Build URL with UTM parameters
        const url = new URL(validated.originalUrl);
        if (validated.utmSource) url.searchParams.set("utm_source", validated.utmSource);
        if (validated.utmMedium) url.searchParams.set("utm_medium", validated.utmMedium);
        if (validated.utmCampaign) url.searchParams.set("utm_campaign", validated.utmCampaign);
        url.searchParams.set("utm_content", content.trim().toLowerCase().replace(/\s+/g, "_"));

        const shortLink = await prisma.shortLink.create({
          data: {
            code,
            originalUrl: url.toString(),
            title: content,
            redirectType: validated.redirectType,
            utmSource: validated.utmSource,
            utmMedium: validated.utmMedium,
            utmCampaign: validated.utmCampaign,
            utmContent: content.trim().toLowerCase().replace(/\s+/g, "_"),
            userId: session.user.id,
          },
        });

        createdLinks.push({
          ...shortLink,
          shortUrl: `${process.env.NEXT_PUBLIC_SHORT_URL}/${shortLink.code}`,
        });

        // Create audit log
        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: "CREATE_LINK",
            targetId: shortLink.id,
            metadata: { code: shortLink.code, batchCreate: true, content },
          },
        });
      } catch (err) {
        errors.push({ content, error: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    if (createdLinks.length > 0) {
      // batch/route.ts doesn't currently accept a workspaceId — links are
      // created in user-scope fallback. Bump that namespace.
      await bumpLinksCache(null, session.user.id);
    }

    return NextResponse.json({
      success: true,
      created: createdLinks.length,
      failed: errors.length,
      links: createdLinks,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Failed to batch create links:", error);
    return NextResponse.json({ error: "Failed to create links" }, { status: 500 });
  }
}
