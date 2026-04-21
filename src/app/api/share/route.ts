import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceScope } from "@/lib/workspace";
import { z } from "zod";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

/**
 * Scope rules:
 *   - shortLinkId only  → single-link share (original behaviour)
 *   - campaignName only → whole-campaign share (scoped to workspace)
 *   - rangeWindow only  → workspace-wide rolling window dashboard
 *   - Any combination is allowed, but at least one of the three must be set.
 */
const createShareSchema = z
  .object({
    shortLinkId: z.string().optional(),
    campaignName: z.string().min(1).optional(),
    rangeWindow: z.enum(["7d", "14d", "30d", "90d"]).optional(),
    password: z.string().optional(),
    expiresAt: z.string().datetime().optional(),
    maxViews: z.number().int().positive().optional(),
  })
  .refine((d) => d.shortLinkId || d.campaignName || d.rangeWindow, {
    message: "At least one of shortLinkId / campaignName / rangeWindow is required.",
  });

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = createShareSchema.parse(body);

    // Every share needs a workspace anchor. Read it from the client's
    // x-workspace-id header (via the fetch patch); fall back to the
    // link's own workspace for link-only shares.
    const scope = await resolveWorkspaceScope(request, session);
    if (!scope) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    let workspaceId: string | null = scope.workspaceId;

    // Per-link shares: verify the link exists and the user has access.
    if (validated.shortLinkId) {
      const link = await prisma.shortLink.findUnique({
        where: { id: validated.shortLinkId },
        select: { id: true, workspaceId: true, createdById: true },
      });
      if (!link) {
        return NextResponse.json({ error: "Link not found" }, { status: 404 });
      }
      if (session.user.role === "MEMBER" && link.createdById !== session.user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
      workspaceId = link.workspaceId ?? workspaceId;
    }

    // Campaign / range shares must be anchored to a verified workspace —
    // resolveWorkspaceScope() above already checked membership.
    if ((validated.campaignName || validated.rangeWindow) && !workspaceId) {
      return NextResponse.json(
        { error: "Campaign / date-range share requires an active workspace." },
        { status: 400 },
      );
    }

    const token = randomBytes(32).toString("hex");
    const hashedPassword = validated.password
      ? await bcrypt.hash(validated.password, 10)
      : null;

    const shareToken = await prisma.shareToken.create({
      data: {
        token,
        shortLinkId: validated.shortLinkId ?? null,
        campaignName: validated.campaignName ?? null,
        rangeWindow: validated.rangeWindow ?? null,
        workspaceId,
        password: hashedPassword,
        expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
        maxViews: validated.maxViews,
        createdById: session.user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "SHARE_LINK",
        targetId: validated.shortLinkId ?? validated.campaignName ?? "range",
        metadata: {
          shareTokenId: shareToken.id,
          scope: {
            shortLinkId: shareToken.shortLinkId,
            campaignName: shareToken.campaignName,
            rangeWindow: shareToken.rangeWindow,
          },
        },
      },
    });

    return NextResponse.json(
      {
        ...shareToken,
        shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/share/${token}`,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Failed to create share token:", error);
    return NextResponse.json(
      { error: "Failed to create share token" },
      { status: 500 },
    );
  }
}
