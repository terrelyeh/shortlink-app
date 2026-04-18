import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceScope } from "@/lib/workspace";
import { bumpLinksCache } from "@/lib/cache-scopes";
import { z } from "zod";

const batchActionSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
  action: z.enum(["delete", "pause", "activate", "archive", "add_tag"]),
  tagId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { ids, action, tagId } = batchActionSchema.parse(body);

    // Verify ownership/workspace scope
    const scope = await resolveWorkspaceScope(request, session);
    if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const accessWhere: Record<string, unknown> = {
      id: { in: ids },
      deletedAt: null,
      ...scope.where,
    };
    const accessibleCount = await prisma.shortLink.count({ where: accessWhere });
    if (accessibleCount !== ids.length) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    let result;

    switch (action) {
      case "delete":
        result = await prisma.shortLink.updateMany({
          where: { id: { in: ids }, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        break;
      case "pause":
        result = await prisma.shortLink.updateMany({
          where: { id: { in: ids }, deletedAt: null },
          data: { status: "PAUSED" },
        });
        break;
      case "activate":
        result = await prisma.shortLink.updateMany({
          where: { id: { in: ids }, deletedAt: null },
          data: { status: "ACTIVE" },
        });
        break;
      case "archive":
        result = await prisma.shortLink.updateMany({
          where: { id: { in: ids }, deletedAt: null },
          data: { status: "ARCHIVED" },
        });
        break;
      case "add_tag":
        if (!tagId) {
          return NextResponse.json({ error: "tagId required for add_tag action" }, { status: 400 });
        }
        // Create TagOnLink records; skip duplicates using upsert pattern
        await Promise.all(
          ids.map((linkId) =>
            prisma.tagOnLink.upsert({
              where: { shortLinkId_tagId: { shortLinkId: linkId, tagId } },
              create: { shortLinkId: linkId, tagId },
              update: {},
            })
          )
        );
        result = { count: ids.length };
        break;
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: action === "delete" ? "DELETE_LINK" : "UPDATE_LINK",
        metadata: { batchAction: action, linkIds: ids, affected: result.count },
      },
    });

    await bumpLinksCache(scope.workspaceId, session.user.id);

    return NextResponse.json({ success: true, affected: result.count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Batch action failed:", error);
    return NextResponse.json({ error: "Batch action failed" }, { status: 500 });
  }
}
