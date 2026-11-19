"use client";

/**
 * Campaign owner (the person whose KPI the campaign counts toward):
 * avatar + name badge, the member picker, and the shared members query.
 */

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export interface OwnerInfo {
  id: string;
  name: string | null;
  email?: string | null;
  image: string | null;
}

export const ownerLabel = (o: OwnerInfo) => o.name || o.email || "—";

export function OwnerAvatar({ owner, size = 20 }: { owner: OwnerInfo; size?: number }) {
  const label = ownerLabel(owner);
  return owner.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={owner.image}
      alt=""
      referrerPolicy="no-referrer"
      width={size}
      height={size}
      className="owner-avatar"
      style={{ width: size, height: size }}
    />
  ) : (
    <span className="owner-avatar owner-avatar-initial" style={{ width: size, height: size, fontSize: size * 0.5 }}>
      {label.charAt(0).toUpperCase()}
    </span>
  );
}

export function OwnerBadge({ owner, size = 20 }: { owner: OwnerInfo | null; size?: number }) {
  const t = useTranslations("campaigns");
  if (!owner) return <span className="owner-unassigned">{t("ownerUnassigned")}</span>;
  return (
    <span className="owner-badge" title={ownerLabel(owner)}>
      <OwnerAvatar owner={owner} size={size} />
      <span className="owner-name">{ownerLabel(owner)}</span>
    </span>
  );
}

/**
 * Members of the current workspace. Same key / endpoint / cached shape as
 * Settings → Members ({ members: [...] }) — the cache is shared, so only
 * `select` reshapes it here.
 */
export function useWorkspaceMembers() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  return useQuery<{ members: { user: OwnerInfo }[] }, Error, OwnerInfo[]>({
    queryKey: ["workspace-members", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`);
      if (!res.ok) throw new Error("Failed to load members");
      return res.json();
    },
    select: (d) => d.members.map((m) => m.user),
  });
}
