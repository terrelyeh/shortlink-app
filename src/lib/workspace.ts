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
 *
 * DEPRECATED: trusts the caller-supplied workspaceId without checking that
 * the user is actually a member. Callers should migrate to
 * resolveWorkspaceScope() which verifies membership.
 */
export function buildWorkspaceWhere(
  workspaceId: string | null,
  userId: string,
  userRole: string
): Record<string, unknown> {
  if (workspaceId) {
    return { workspaceId };
  }

  if (userRole === "MEMBER" || userRole === "VIEWER") {
    return { createdById: userId };
  }

  return {};
}

/**
 * Resolve the effective workspace scope for a request, verifying that the
 * authenticated user is actually a member of the requested workspace.
 *
 * Returns:
 *   - { workspaceId, where } on success (workspaceId is null when the caller
 *     didn't request a specific workspace)
 *   - null when the user supplied a workspaceId they are not a member of
 *     (caller should return 403)
 */
export async function resolveWorkspaceScope(
  request: NextRequest,
  session: { user: { id: string; role: string } },
): Promise<{ workspaceId: string | null; where: Record<string, unknown> } | null> {
  const workspaceId = getWorkspaceId(request);

  if (workspaceId) {
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) return null;
    return { workspaceId, where: { workspaceId } };
  }

  // No header sent — typical race when the browser fires a request
  // before WorkspaceContext has populated localStorage. Fall back to
  // the user's primary workspace (oldest joined) so writes don't end
  // up as workspaceId=NULL orphans that the OWNER can't see later.
  if (session?.user?.id) {
    const member = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id },
      orderBy: { joinedAt: "asc" },
      select: { workspaceId: true },
    });
    if (member) {
      return {
        workspaceId: member.workspaceId,
        where: { workspaceId: member.workspaceId },
      };
    }
    // Genuine no-workspace case — user has zero memberships. Should
    // really only happen for users mid-onboarding.
    return { workspaceId: null, where: { createdById: session.user.id } };
  }

  return { workspaceId: null, where: {} };
}

/**
 * Whether `userId` is allowed to mutate (edit / delete / clone / share)
 * a resource. Three tiers:
 *   - Creator → always yes
 *   - OWNER / ADMIN of the resource's workspace → yes (admin override)
 *   - Anyone else → no
 *
 * Orphan resources (workspaceId === null) only the original creator
 * can touch — there's no workspace context to delegate authority.
 *
 * Use this everywhere instead of `session.user.role === "MEMBER"` —
 * that legacy check looked at the global User.role field, which is
 * orthogonal to the workspace role system that actually drives the
 * permission model now.
 */
export async function canUserActOnResource(
  userId: string,
  resource: { createdById: string | null; workspaceId: string | null },
): Promise<boolean> {
  if (resource.createdById && resource.createdById === userId) return true;
  if (!resource.workspaceId) return false;

  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: resource.workspaceId,
        userId,
      },
    },
    select: { role: true },
  });

  return member?.role === "OWNER" || member?.role === "ADMIN";
}
