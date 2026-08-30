import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isWorkspaceAdmin, resolveWorkspaceAccess } from "@/lib/workspace";

// GET - List audit logs (workspace OWNER / ADMIN only)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Workspace OWNER / ADMIN only. This used to check the legacy global
    // User.role, which denied everyone — workspace owners are "MEMBER" there.
    const access = await resolveWorkspaceAccess(request, session);
    if (!access || !isWorkspaceAdmin(access.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const action = searchParams.get("action");
    const userId = searchParams.get("userId");

    // AuditLog has no workspaceId column, so scope by authorship instead:
    // only entries written by members of the caller's workspace. Without
    // this the endpoint would return every workspace's history.
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: access.workspaceId },
      select: { userId: true },
    });
    const memberIds = members.map((m) => m.userId);

    // A userId filter narrows within the workspace; asking for a non-member
    // returns nothing rather than silently falling back to everyone.
    const where: Record<string, unknown> = {
      userId: userId ? (memberIds.includes(userId) ? userId : { in: [] }) : { in: memberIds },
    };

    if (action) {
      where.action = action;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { name: true, email: true, image: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
