import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bumpLinksCache } from "@/lib/cache-scopes";
import { canUserActOnResource } from "@/lib/workspace";

/**
 * POST /api/links/[id]/restore — undo a soft delete.
 *
 * The short code stays reserved while a link is in the trash (`code` is
 * globally unique and soft-deleted rows keep it), so restoring can never
 * collide with a newer link.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const link = await prisma.shortLink.findUnique({ where: { id } });

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }
    if (!(await canUserActOnResource(session.user.id, link))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (!link.deletedAt) {
      // Already live — treat as success so a double click is harmless.
      return NextResponse.json({ success: true, alreadyActive: true });
    }

    await prisma.shortLink.update({
      where: { id },
      data: { deletedAt: null },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "RESTORE_LINK",
        targetId: id,
        metadata: { code: link.code },
      },
    });

    await bumpLinksCache(link.workspaceId, session.user.id);
    if (link.createdById && link.createdById !== session.user.id) {
      await bumpLinksCache(null, link.createdById);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to restore link:", error);
    return NextResponse.json({ error: "Failed to restore link" }, { status: 500 });
  }
}
