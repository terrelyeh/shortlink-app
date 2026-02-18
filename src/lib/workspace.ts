import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export interface WorkspaceAccess {
  workspaceId: string;
  role: string;
}

/**
 * Extract workspaceId from request query params or headers.
 */
export function getWorkspaceId(request: NextRequest): string | null {
  const { searchParams } = new URL(request.url);
  return searchParams.get("workspaceId") || request.headers.get("x-workspace-id") || null;
}

/**
 * Verify user has access to the workspace and return their workspace role.
 * Returns null if the user does not have access.
 */
export async function checkWorkspaceAccess(
  workspaceId: string,
  userId: string
): Promise<WorkspaceAccess | null> {
  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId, userId },
    },
    select: { role: true },
  });

  if (!member) return null;

  return { workspaceId, role: member.role };
}

/**
 * Build the workspace-aware where clause for queries.
 * If workspaceId is provided, filter by it. Otherwise fall back to user-based filtering.
 */
export function buildWorkspaceWhere(
  workspaceId: string | null,
  userId: string,
  userRole: string
): Record<string, unknown> {
  if (workspaceId) {
    return { workspaceId };
  }

  // Fallback: non-workspace mode (backwards compatible)
  if (userRole === "MEMBER" || userRole === "VIEWER") {
    return { createdById: userId };
  }

  // ADMIN/MANAGER see all
  return {};
}
