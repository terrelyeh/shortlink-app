/**
 * Named cache-invalidation scopes used by route handlers.
 *
 * Keeping these out of the route files themselves avoids cross-route module
 * imports (which Next.js discourages) and gives one canonical place to edit
 * when adding new cached resources.
 */

import { cacheBumpVersion } from "@/lib/cache";

/** /api/links list cache — bump on any link create/update/delete. */
export function linksCacheNamespace(
  workspaceId: string | null,
  userId: string,
): string {
  return workspaceId ? `links:w:${workspaceId}` : `links:u:${userId}`;
}

export async function bumpLinksCache(
  workspaceId: string | null,
  userId: string,
): Promise<void> {
  await cacheBumpVersion(linksCacheNamespace(workspaceId, userId));
}
