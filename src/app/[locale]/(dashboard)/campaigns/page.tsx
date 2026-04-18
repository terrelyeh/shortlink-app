/**
 * /campaigns — Server Component.
 *
 * Pre-fetches the active+draft+completed campaign list in a single DB
 * roundtrip so the HTML arrives with data. CampaignsClient still owns
 * search, filter and CRUD; it only skips the mount-time fetch.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildWorkspaceWhere, checkWorkspaceAccess } from "@/lib/workspace";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import CampaignsClient from "./CampaignsClient";
import type { Prisma } from "@prisma/client";

export default async function CampaignsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const requestHeaders = await headers();
  const workspaceId = requestHeaders.get("x-workspace-id") || null;
  if (workspaceId && !(await checkWorkspaceAccess(workspaceId, session.user.id))) {
    redirect("/");
  }
  const workspaceWhere = buildWorkspaceWhere(
    workspaceId,
    session.user.id,
    session.user.role,
  );

  // Load ALL campaigns (including ARCHIVED) so the client can filter without
  // round-trips. At realistic scale (<500 campaigns) this is cheap.
  const where: Prisma.CampaignWhereInput = {
    ...workspaceWhere,
  };

  const campaigns = await prisma.campaign.findMany({
    where,
    include: {
      tags: { include: { tag: true } },
      _count: { select: { links: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const initialCampaigns = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    displayName: c.displayName,
    description: c.description,
    status: c.status,
    startDate: c.startDate ? c.startDate.toISOString() : null,
    endDate: c.endDate ? c.endDate.toISOString() : null,
    defaultSource: c.defaultSource,
    defaultMedium: c.defaultMedium,
    linkCount: c._count.links,
    tags: c.tags.map((t) => ({ id: t.tag.id, name: t.tag.name })),
  }));

  return <CampaignsClient initialCampaigns={initialCampaigns} />;
}
