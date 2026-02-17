import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const batchActionSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
  action: z.enum(["delete", "pause", "activate", "archive"]),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { ids, action } = batchActionSchema.parse(body);

    // Verify ownership for MEMBER role
    if (session.user.role === "MEMBER") {
      const ownedCount = await prisma.shortLink.count({
        where: { id: { in: ids }, createdById: session.user.id, deletedAt: null },
      });
      if (ownedCount !== ids.length) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
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
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: action === "delete" ? "DELETE_LINK" : "UPDATE_LINK",
        metadata: { batchAction: action, linkIds: ids, affected: result.count },
      },
    });

    return NextResponse.json({ success: true, affected: result.count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Batch action failed:", error);
    return NextResponse.json({ error: "Batch action failed" }, { status: 500 });
  }
}
