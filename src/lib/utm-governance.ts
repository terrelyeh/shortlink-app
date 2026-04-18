/**
 * UTM governance — enforces workspace-scoped whitelists for source/medium.
 *
 * The Settings > Governance tab lets ADMIN/MANAGER define approved values.
 * When either list is empty, no restrictions apply (governance opt-in).
 * When populated, the server blocks any create/update that tries to use a
 * value not in the list. The client-side UTMBuilder surfaces the same
 * rules as inline warnings before the user hits submit.
 */

import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet, cacheKey } from "@/lib/cache";

export interface UtmGovernance {
  approvedSources: string[];
  approvedMediums: string[];
}

const EMPTY: UtmGovernance = { approvedSources: [], approvedMediums: [] };

/**
 * Look up the governance settings for a workspace. Returns empty lists
 * (no restrictions) when no workspace is provided or the workspace has
 * no utmSettings configured. Cached in Redis for 60s — these change rarely.
 */
export async function getWorkspaceUtmGovernance(
  workspaceId: string | null,
): Promise<UtmGovernance> {
  if (!workspaceId) return EMPTY;

  const key = cacheKey("utm-gov", workspaceId);
  const cached = await cacheGet<UtmGovernance>(key);
  if (cached) return cached;

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { utmSettings: true },
  });
  const raw = (ws?.utmSettings as Partial<UtmGovernance> | null) ?? null;
  const result: UtmGovernance = {
    approvedSources: raw?.approvedSources ?? [],
    approvedMediums: raw?.approvedMediums ?? [],
  };

  await cacheSet(key, result, 60);
  return result;
}

/** Normalize to the canonical stored form (lowercase, trimmed). */
function norm(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

/**
 * Check whether the supplied UTM values satisfy the governance rules.
 * Returns an array of human-readable error strings (empty when valid).
 *
 * Governance is *opt-in per field*: if approvedSources is empty we skip
 * the source check entirely. A workspace can enforce only medium, only
 * source, or both.
 */
export function validateUtmAgainstGovernance(
  governance: UtmGovernance,
  utm: { source?: string | null; medium?: string | null },
): string[] {
  const errors: string[] = [];

  if (governance.approvedSources.length > 0 && utm.source) {
    const s = norm(utm.source);
    if (!governance.approvedSources.includes(s)) {
      errors.push(
        `UTM source "${utm.source}" is not on this workspace's approved list (${governance.approvedSources.join(", ")}).`,
      );
    }
  }

  if (governance.approvedMediums.length > 0 && utm.medium) {
    const m = norm(utm.medium);
    if (!governance.approvedMediums.includes(m)) {
      errors.push(
        `UTM medium "${utm.medium}" is not on this workspace's approved list (${governance.approvedMediums.join(", ")}).`,
      );
    }
  }

  return errors;
}
