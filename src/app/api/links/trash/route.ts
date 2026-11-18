import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isWorkspaceAdmin, resolveWorkspaceAccess, resolveWorkspaceScope } from "@/lib/workspace";

// Cap the trash listing — this is a recovery view, not an archive browser.
const TRASH_CAP = 200;

/**
 * GET /api/links/trash — soft-deleted links in the caller's workspace,
 * most recently deleted first.
 *
 * Not Redis-cached: it's opened rarely and must reflect a delete/restore
 * the user just made. Each row carries `canRestore` so the UI can hide
 * the button for links the caller isn't allowed to touch (same rule as
 * canUserActOnResource: creator, or workspace OWNER/ADMIN).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scope = await resolveWorkspaceScope(request, session);
    if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const access = scope.workspaceId ? await resolveWorkspaceAccess(request, session) : null;
    const isAdmin = access ? isWorkspaceAdmin(access.role) : false;

    const links = await prisma.shortLink.findMany({
      where: { ...scope.where, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      take: TRASH_CAP,
      select: {
        id: true,
        code: true,
        title: true,
        originalUrl: true,
        ogTitle: true,
        ogImage: true,
        utmCampaign: true,
        clickCount: true,
        createdById: true,
        createdAt: true,
        deletedAt: true,
      },
    });

    return NextResponse.json({
      links: links.map(({ createdById, ...l }) => ({
        ...l,
        canRestore: isAdmin || createdById === session.user.id,
      })),
    });
  } catch (error) {
    console.error("Failed to list trashed links:", error);
    return NextResponse.json({ error: "Failed to list trashed links" }, { status: 500 });
  }
}
