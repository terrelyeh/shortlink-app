/**
 * /links — Server Component (client-side filter mode).
 *
 * Loads up to LINK_CAP links and all tags in one shot, then hands the
 * whole list to LinksClient which filters/sorts/searches in-memory.
 * No more round-trips on every keystroke or filter button.
 *
 * Over LINK_CAP the server truncates and the client shows a banner.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildWorkspaceWhere, checkWorkspaceAccess } from "@/lib/workspace";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import LinksClient from "./LinksClient";
import type { Prisma } from "@prisma/client";

const LINK_CAP = 500;

export default async function LinksPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string; workspaceId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const params = await searchParams;
  const requestHeaders = await headers();
  const workspaceId =
    params.workspaceId || requestHeaders.get("x-workspace-id") || null;
  if (workspaceId && !(await checkWorkspaceAccess(workspaceId, session.user.id))) {
    redirect("/");
  }
  const workspaceWhere = buildWorkspaceWhere(
    workspaceId,
    session.user.id,
    session.user.role,
  );

  const where: Prisma.ShortLinkWhereInput = {
    deletedAt: null,
    ...workspaceWhere,
  };

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [links, total, tags] = await Promise.all([
    prisma.shortLink.findMany({
      where,
      include: {
        _count: { select: { clicks: true, conversions: true } },
        tags: { include: { tag: true } },
      },
      orderBy: { createdAt: "desc" },
      take: LINK_CAP,
    }),
    prisma.shortLink.count({ where }),
    prisma.tag.findMany({
      where: workspaceId ? { workspaceId } : {},
      include: { _count: { select: { links: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  // Trend enrichment — 7d clicks per link plus the previous 7d for percentage change
  const linkIds = links.map((l) => l.id);
  const [clicks7d, clicksPrev7d] =
    linkIds.length > 0
      ? await Promise.all([
          prisma.click.groupBy({
            by: ["shortLinkId"],
            where: {
              shortLinkId: { in: linkIds },
              timestamp: { gte: sevenDaysAgo },
            },
            _count: { _all: true },
          }),
          prisma.click.groupBy({
            by: ["shortLinkId"],
            where: {
              shortLinkId: { in: linkIds },
              timestamp: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
            },
            _count: { _all: true },
          }),
        ])
      : [[], []];

  const clicks7dMap = new Map(
    (clicks7d as { shortLinkId: string; _count: { _all: number } }[]).map(
      (r) => [r.shortLinkId, r._count._all],
    ),
  );
  const clicksPrev7dMap = new Map(
    (clicksPrev7d as { shortLinkId: string; _count: { _all: number } }[]).map(
      (r) => [r.shortLinkId, r._count._all],
    ),
  );

  const enrichedLinks = links.map((link) => {
    const c7 = clicks7dMap.get(link.id) ?? 0;
    const cp = clicksPrev7dMap.get(link.id) ?? 0;
    const trendPct = cp > 0 ? Math.round(((c7 - cp) / cp) * 100) : null;
    return {
      ...link,
      createdAt: link.createdAt.toISOString(),
      // Date fields → strings so the Client boundary can take them.
      startsAt: link.startsAt ? link.startsAt.toISOString() : null,
      clicksLast7d: c7,
      trendPct,
    };
  });

  const initialTags = tags.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    _count: { links: t._count.links },
  }));

  return (
    <LinksClient
      initialLinks={enrichedLinks as unknown as Parameters<typeof LinksClient>[0]["initialLinks"]}
      initialTags={initialTags}
      initialCampaign={params.campaign ?? ""}
      totalLinks={total}
      loadedCap={LINK_CAP}
    />
  );
}
