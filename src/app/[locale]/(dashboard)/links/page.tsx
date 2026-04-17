/**
 * /links — Server Component.
 *
 * Fetches the initial page of links and the tag list directly from Prisma
 * on the server so the HTML already contains the data when it reaches the
 * browser. No mount-time spinner or client fetch waterfall on first visit.
 *
 * LinksClient still owns all interactivity (search, filters, batch ops).
 * It re-fetches via /api/links when the user changes filters — we only skip
 * the mount fetch, not the subsequent ones.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildWorkspaceWhere } from "@/lib/workspace";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import LinksClient from "./LinksClient";
import type { Prisma } from "@prisma/client";

interface SearchParams {
  page?: string;
  search?: string;
  status?: string;
  campaign?: string;
  tagId?: string;
  sortBy?: string;
  sortOrder?: string;
}

export default async function LinksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin");
  }

  const params = await searchParams;
  const page = parseInt(params.page || "1");
  const limit = 20;
  const search = params.search || "";
  const status = params.status;
  const campaign = params.campaign;
  const tagId = params.tagId;
  const sortBy = params.sortBy || "createdAt";
  const sortOrder = params.sortOrder || "desc";

  // Same lookup order as getWorkspaceId() in /api/* routes, but adapted for
  // a Server Component: check query param, then the x-workspace-id request header.
  const requestHeaders = await headers();
  const workspaceId =
    (params as Record<string, string | undefined>).workspaceId ||
    requestHeaders.get("x-workspace-id") ||
    null;
  const workspaceWhere = buildWorkspaceWhere(
    workspaceId,
    session.user.id,
    session.user.role,
  );

  const where: Prisma.ShortLinkWhereInput = {
    deletedAt: null,
    ...workspaceWhere,
  };

  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { originalUrl: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
    ];
  }
  if (status) where.status = status as Prisma.ShortLinkWhereInput["status"];
  if (campaign) {
    where.utmCampaign = campaign === "__none__" ? null : campaign;
  }
  if (tagId) {
    where.tags = { some: { tagId } };
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // One Promise.all wave for everything we need on first paint
  const [links, total, tags] = await Promise.all([
    prisma.shortLink.findMany({
      where,
      include: {
        _count: { select: { clicks: true } },
        tags: { include: { tag: true } },
      },
      orderBy:
        sortBy === "clicks"
          ? { clicks: { _count: sortOrder as "asc" | "desc" } }
          : { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.shortLink.count({ where }),
    prisma.tag.findMany({
      where: workspaceId ? { workspaceId } : {},
      include: { _count: { select: { links: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  // Trend enrichment (same as /api/links) — only if we have any links
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
    // Serialise Dates to strings so client-side props are pure JSON
    return {
      ...link,
      createdAt: link.createdAt.toISOString(),
      clicksLast7d: c7,
      trendPct,
    };
  });

  const pagination = {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };

  // TagOption in LinksClient expects { id, name, color?, _count: { links } }
  const initialTags = tags.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    _count: { links: t._count.links },
  }));

  return (
    <LinksClient
      // Cast: enrichedLinks has the superset of fields LinksClient needs (id, code,
      // originalUrl, title, status, createdAt, utmCampaign, _count, tags, clicksLast7d,
      // trendPct). Extra fields are harmless.
      initialLinks={enrichedLinks as unknown as Parameters<typeof LinksClient>[0]["initialLinks"]}
      initialPagination={pagination}
      initialTags={initialTags}
      initialCampaign={campaign ?? ""}
    />
  );
}
