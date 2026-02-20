import { getTranslations } from "next-intl/server";
import { Link2, MousePointerClick, Users, TrendingUp, Plus, ArrowRight, Megaphone, FileText, Zap, ExternalLink, BarChart3, Clock, ArrowUpRight, ArrowDownRight } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function generateMetadata() {
  const t = await getTranslations("dashboard");
  return {
    title: t("title"),
  };
}

// Get real stats from database
async function getDashboardStats(userId: string, userRole: string) {
  const isAdminOrManager = userRole === "ADMIN" || userRole === "MANAGER";
  const whereClause = isAdminOrManager ? { deletedAt: null } : { createdById: userId, deletedAt: null };

  // Get total links and active links
  const [totalLinks, activeLinks, pausedLinks] = await Promise.all([
    prisma.shortLink.count({ where: whereClause }),
    prisma.shortLink.count({ where: { ...whereClause, status: "ACTIVE" } }),
    prisma.shortLink.count({ where: { ...whereClause, status: "PAUSED" } }),
  ]);

  // Get click stats for last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  // Get today's clicks
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Get link IDs for the user
  const userLinks = await prisma.shortLink.findMany({
    where: whereClause,
    select: { id: true },
  });
  const linkIds = userLinks.map((l: { id: string }) => l.id);

  // Current period clicks (last 30 days), previous period, today, and unique visitors
  const [currentPeriodClicks, previousPeriodClicks, todayClicks, uniqueVisitors] = await Promise.all([
    linkIds.length > 0 ? prisma.click.count({
      where: {
        shortLinkId: { in: linkIds },
        timestamp: { gte: thirtyDaysAgo },
      },
    }) : 0,
    linkIds.length > 0 ? prisma.click.count({
      where: {
        shortLinkId: { in: linkIds },
        timestamp: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
      },
    }) : 0,
    linkIds.length > 0 ? prisma.click.count({
      where: {
        shortLinkId: { in: linkIds },
        timestamp: { gte: todayStart },
      },
    }) : 0,
    linkIds.length > 0 ? prisma.click.groupBy({
      by: ['ipHash'],
      where: {
        shortLinkId: { in: linkIds },
        timestamp: { gte: thirtyDaysAgo },
      },
    }).then((results: { ipHash: string | null }[]) => results.length) : 0,
  ]);

  // Calculate trend
  const clicksTrend = previousPeriodClicks > 0
    ? ((currentPeriodClicks - previousPeriodClicks) / previousPeriodClicks) * 100
    : 0;

  // Calculate avg clicks per link
  const avgClicksPerLink = activeLinks > 0 ? Math.round(currentPeriodClicks / activeLinks) : 0;

  return {
    totalClicks: currentPeriodClicks,
    todayClicks,
    uniqueVisitors,
    totalLinks,
    activeLinks,
    pausedLinks,
    avgClicksPerLink,
    clicksTrend: Math.round(clicksTrend * 10) / 10,
  };
}

// Get top performing links
async function getTopLinks(userId: string, userRole: string, limit = 5) {
  const isAdminOrManager = userRole === "ADMIN" || userRole === "MANAGER";
  const whereClause = isAdminOrManager ? { deletedAt: null } : { createdById: userId, deletedAt: null };

  const links = await prisma.shortLink.findMany({
    where: whereClause,
    include: {
      _count: {
        select: { clicks: true },
      },
      tags: {
        include: { tag: true },
        take: 2,
      },
    },
    orderBy: {
      clicks: {
        _count: 'desc',
      },
    },
    take: limit,
  });

  return links.map((link: { id: string; code: string; originalUrl: string; title: string | null; status: string; createdAt: Date; _count: { clicks: number }; tags: { tag: { id: string; name: string; color?: string | null } }[] }) => ({
    id: link.id,
    code: link.code,
    originalUrl: link.originalUrl,
    title: link.title,
    status: link.status,
    clicks: link._count.clicks,
    createdAt: link.createdAt,
    tags: link.tags.map((t: { tag: { id: string; name: string; color?: string | null } }) => t.tag),
  }));
}

// Get recent links
async function getRecentLinks(userId: string, userRole: string, limit = 5) {
  const isAdminOrManager = userRole === "ADMIN" || userRole === "MANAGER";
  const whereClause = isAdminOrManager ? { deletedAt: null } : { createdById: userId, deletedAt: null };

  const links = await prisma.shortLink.findMany({
    where: whereClause,
    include: {
      _count: {
        select: { clicks: true },
      },
      tags: {
        include: { tag: true },
        take: 2,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });

  return links.map((link: { id: string; code: string; originalUrl: string; title: string | null; status: string; createdAt: Date; _count: { clicks: number }; tags: { tag: { id: string; name: string; color?: string | null } }[] }) => ({
    id: link.id,
    code: link.code,
    originalUrl: link.originalUrl,
    title: link.title,
    status: link.status,
    clicks: link._count.clicks,
    createdAt: link.createdAt,
    tags: link.tags.map((t: { tag: { id: string; name: string; color?: string | null } }) => t.tag),
  }));
}

// Get top campaigns by click count
async function getTopCampaigns(userId: string, userRole: string, limit = 5) {
  const isAdminOrManager = userRole === "ADMIN" || userRole === "MANAGER";
  const whereClause = isAdminOrManager
    ? { deletedAt: null, utmCampaign: { not: null } }
    : { createdById: userId, deletedAt: null, utmCampaign: { not: null } };

  const links = await prisma.shortLink.findMany({
    where: whereClause,
    select: {
      utmCampaign: true,
      utmSource: true,
      utmMedium: true,
      _count: { select: { clicks: true } },
    },
  });

  // Aggregate by campaign name
  const campaignMap = new Map<string, { linkCount: number; clickCount: number; sources: Set<string>; mediums: Set<string> }>();
  links.forEach((link: { utmCampaign: string | null; utmSource: string | null; utmMedium: string | null; _count: { clicks: number } }) => {
    if (!link.utmCampaign) return;
    const existing = campaignMap.get(link.utmCampaign);
    if (existing) {
      existing.linkCount++;
      existing.clickCount += link._count.clicks;
      if (link.utmSource) existing.sources.add(link.utmSource);
      if (link.utmMedium) existing.mediums.add(link.utmMedium);
    } else {
      const sources = new Set<string>();
      const mediums = new Set<string>();
      if (link.utmSource) sources.add(link.utmSource);
      if (link.utmMedium) mediums.add(link.utmMedium);
      campaignMap.set(link.utmCampaign, { linkCount: 1, clickCount: link._count.clicks, sources, mediums });
    }
  });

  return Array.from(campaignMap.entries())
    .map(([name, stats]) => ({
      name,
      linkCount: stats.linkCount,
      clickCount: stats.clickCount,
      sources: Array.from(stats.sources).slice(0, 2),
      mediums: Array.from(stats.mediums).slice(0, 2),
    }))
    .sort((a, b) => b.clickCount - a.clickCount)
    .slice(0, limit);
}

// Helper: relative time
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return new Date(date).toLocaleDateString();
}

// Helper: status dot color
function statusColor(status: string) {
  switch (status) {
    case "ACTIVE": return "bg-emerald-400";
    case "PAUSED": return "bg-amber-400";
    case "ARCHIVED": return "bg-slate-300";
    default: return "bg-slate-300";
  }
}

// Helper: truncate URL for display
function displayUrl(url: string, maxLen = 45) {
  const clean = url.replace(/^https?:\/\/(www\.)?/, "");
  return clean.length > maxLen ? clean.slice(0, maxLen) + "..." : clean;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin");
  }

  const t = await getTranslations("dashboard");
  const userId = session.user.id;
  const userRole = session.user.role;

  // Fetch real data
  const [stats, topLinks, recentLinks, topCampaigns] = await Promise.all([
    getDashboardStats(userId, userRole),
    getTopLinks(userId, userRole),
    getRecentLinks(userId, userRole),
    getTopCampaigns(userId, userRole),
  ]);

  const shortBaseUrl = process.env.NEXT_PUBLIC_SHORT_URL || "http://localhost:3000/s";

  // Show empty state if no links
  if (stats.totalLinks === 0) {
    return (
      <div className="space-y-8">
        <div className="text-center py-8">
          <div className="text-slate-300 mb-4">
            <Zap className="w-10 h-10 mx-auto" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">
            {t("emptyState.title")}
          </h1>
          <p className="text-slate-500 max-w-md mx-auto">
            {t("emptyState.description")}
          </p>
        </div>

        <div className="max-w-lg mx-auto space-y-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider px-1">{t("quickStart.title")}</p>
          {[
            { icon: <Link2 className="w-4 h-4" />, title: t("quickStart.createLink"), desc: t("quickStart.createLinkDesc"), href: "/links/new" },
            { icon: <Megaphone className="w-4 h-4" />, title: t("quickStart.setupCampaign"), desc: t("quickStart.setupCampaignDesc"), href: "/campaigns" },
            { icon: <FileText className="w-4 h-4" />, title: t("quickStart.createTemplate"), desc: t("quickStart.createTemplateDesc"), href: "/templates" },
          ].map((step, i) => (
            <Link
              key={i}
              href={step.href}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                {step.icon}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">{step.title}</p>
                <p className="text-xs text-slate-500">{step.desc}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const showQuickStart = stats.totalLinks < 5;

  // Find the max clicks for Top Links bar chart
  const maxClicks = topLinks.length > 0 ? Math.max(...topLinks.map((l: { clicks: number }) => l.clicks), 1) : 1;

  // Find the max clicks for campaigns bar
  const maxCampaignClicks = topCampaigns.length > 0 ? Math.max(...topCampaigns.map((c: { clickCount: number }) => c.clickCount), 1) : 1;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t("last30DaysOverview")}</p>
        </div>
        <Link
          href="/links/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#03A9F4] text-white text-sm font-medium rounded-lg hover:bg-[#0288D1] transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t("newLink")}
        </Link>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Clicks — primary stat */}
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
              <MousePointerClick className="w-4 h-4 text-[#03A9F4]" />
            </div>
            <span className="text-xs font-medium text-slate-500">{t("totalClicks")}</span>
          </div>
          <p className="text-3xl font-semibold text-slate-900">{stats.totalClicks.toLocaleString()}</p>
          <div className="flex items-center gap-2 mt-1.5">
            {stats.clicksTrend !== 0 && (
              <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${stats.clicksTrend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {stats.clicksTrend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {Math.abs(stats.clicksTrend)}%
              </span>
            )}
            {stats.todayClicks > 0 && (
              <span className="text-xs text-slate-400">{t("todayCount", { count: stats.todayClicks })}</span>
            )}
          </div>
        </div>

        {/* Unique Visitors */}
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
              <Users className="w-4 h-4 text-violet-500" />
            </div>
            <span className="text-xs font-medium text-slate-500">{t("uniqueVisitors")}</span>
          </div>
          <p className="text-3xl font-semibold text-slate-900">{stats.uniqueVisitors.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1.5">{t("avgPerLink", { count: stats.avgClicksPerLink })}</p>
        </div>

        {/* Total Links */}
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Link2 className="w-4 h-4 text-amber-500" />
            </div>
            <span className="text-xs font-medium text-slate-500">{t("totalLinks")}</span>
          </div>
          <p className="text-3xl font-semibold text-slate-900">{stats.totalLinks}</p>
          <p className="text-xs text-slate-400 mt-1.5">
            <span className="text-emerald-600">{stats.activeLinks} {t("activeLabel")}</span>
            {stats.pausedLinks > 0 && (
              <span className="text-slate-400"> · {stats.pausedLinks} {t("pausedLabel")}</span>
            )}
          </p>
        </div>

        {/* Click Rate */}
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <span className="text-xs font-medium text-slate-500">{t("avgPerLink")}</span>
          </div>
          <p className="text-3xl font-semibold text-slate-900">{stats.avgClicksPerLink}</p>
          <p className="text-xs text-slate-400 mt-1.5">{t("clicksPerActiveLink")}</p>
        </div>
      </div>

      {/* Two-column layout: Top Links + Recent Links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Links */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <h2 className="text-base font-semibold text-slate-900">{t("topLinks")}</h2>
            </div>
            <Link href="/links" className="text-xs text-[#03A9F4] hover:text-[#0288D1] font-medium">
              {t("viewAll")} →
            </Link>
          </div>
          {topLinks.length > 0 ? (
            <div className="bg-white rounded-xl border border-slate-100">
              {topLinks.map((link: { id: string; code: string; originalUrl: string; title: string | null; status: string; clicks: number; createdAt: Date; tags: { id: string; name: string; color?: string | null }[] }, index: number) => (
                <Link
                  key={link.id}
                  href={`/links/${link.id}`}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group ${
                    index > 0 ? "border-t border-slate-100" : ""
                  }`}
                >
                  {/* Rank badge */}
                  <span className={`w-6 h-6 rounded-md text-xs font-semibold flex items-center justify-center shrink-0 ${
                    index === 0 ? "bg-sky-50 text-[#03A9F4]" : index === 1 ? "bg-slate-100 text-slate-500" : "bg-slate-50 text-slate-400"
                  }`}>
                    {index + 1}
                  </span>

                  {/* Link info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor(link.status)}`} />
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {link.title || `/${link.code}`}
                      </p>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5 pl-3">
                      {shortBaseUrl}/{link.code} → {displayUrl(link.originalUrl)}
                    </p>
                  </div>

                  {/* Click count with visual bar */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#03A9F4] rounded-full"
                        style={{ width: `${Math.max((link.clicks / maxClicks) * 100, 4)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-slate-700 tabular-nums w-12 text-right">
                      {link.clicks.toLocaleString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 py-8 text-center">
              <p className="text-sm text-slate-400">{t("noLinksYet")}</p>
            </div>
          )}
        </div>

        {/* Recent Links */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <h2 className="text-base font-semibold text-slate-900">{t("recentLinks")}</h2>
            </div>
            <Link href="/links" className="text-xs text-[#03A9F4] hover:text-[#0288D1] font-medium">
              {t("viewAll")} →
            </Link>
          </div>
          {recentLinks.length > 0 ? (
            <div className="bg-white rounded-xl border border-slate-100">
              {recentLinks.map((link: { id: string; code: string; originalUrl: string; title: string | null; status: string; clicks: number; createdAt: Date; tags: { id: string; name: string; color?: string | null }[] }, index: number) => (
                <Link
                  key={link.id}
                  href={`/links/${link.id}`}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group ${
                    index > 0 ? "border-t border-slate-100" : ""
                  }`}
                >
                  {/* Status dot + info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor(link.status)}`} />
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {link.title || `/${link.code}`}
                      </p>
                      {link.tags.length > 0 && (
                        <div className="flex items-center gap-1 ml-1">
                          {link.tags.map((tag: { id: string; name: string }) => (
                            <span key={tag.id} className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">{tag.name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5 pl-3">
                      {displayUrl(link.originalUrl)}
                    </p>
                  </div>

                  {/* Clicks */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-slate-700 tabular-nums">{link.clicks.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400">{t("clicksLabel")}</p>
                  </div>

                  {/* Relative time */}
                  <span className="text-xs text-slate-400 tabular-nums shrink-0 w-14 text-right">
                    {getRelativeTime(link.createdAt)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 py-8 text-center">
              <p className="text-sm text-slate-400">{t("noLinksYet")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Top Campaigns */}
      {topCampaigns.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-slate-400" />
              <h2 className="text-base font-semibold text-slate-900">{t("topCampaigns")}</h2>
            </div>
            <Link href="/campaigns" className="text-xs text-[#03A9F4] hover:text-[#0288D1] font-medium">
              {t("viewAll")} →
            </Link>
          </div>
          <div className="bg-white rounded-xl border border-slate-100">
            {/* Table header */}
            <div className="flex items-center gap-4 px-4 py-2.5 border-b border-slate-100">
              <span className="flex-1 text-xs font-medium text-slate-400 uppercase tracking-wider">{t("campaignName")}</span>
              <span className="w-32 text-xs font-medium text-slate-400 uppercase tracking-wider">{t("sourceMedium")}</span>
              <span className="w-14 text-xs font-medium text-slate-400 uppercase tracking-wider text-right">{t("linksLabel")}</span>
              <span className="w-28 text-xs font-medium text-slate-400 uppercase tracking-wider text-right">{t("clicksLabel")}</span>
            </div>
            {topCampaigns.map((campaign: { name: string; linkCount: number; clickCount: number; sources: string[]; mediums: string[] }, index: number) => (
              <div
                key={campaign.name}
                className={`flex items-center gap-4 px-4 py-3 hover:bg-slate-50/50 transition-colors ${
                  index > 0 ? "border-t border-slate-50" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <span className="inline-flex items-center px-2 py-0.5 bg-violet-50 text-violet-700 border border-violet-100 rounded-md text-sm font-medium font-mono truncate max-w-full">
                    {campaign.name}
                  </span>
                </div>
                <div className="w-32 flex flex-wrap items-center gap-1">
                  {campaign.sources.slice(0, 2).map((src: string) => (
                    <span
                      key={src}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-50 text-cyan-700 border border-cyan-100"
                    >
                      {src}
                    </span>
                  ))}
                  {campaign.mediums.slice(0, 1).map((med: string) => (
                    <span
                      key={med}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-100"
                    >
                      {med}
                    </span>
                  ))}
                  {campaign.sources.length === 0 && campaign.mediums.length === 0 && (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </div>
                <span className="w-14 text-sm text-slate-500 tabular-nums text-right">{campaign.linkCount}</span>
                <div className="w-28 flex items-center gap-2 justify-end">
                  <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-400 rounded-full"
                      style={{ width: `${Math.max((campaign.clickCount / maxCampaignClicks) * 100, 8)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-slate-700 tabular-nums">
                    {campaign.clickCount.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Start — only for new users */}
      {showQuickStart && (
        <div className="border-t border-slate-100 pt-6">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">{t("quickStart.title")}</p>
          <div className="space-y-1">
            {[
              { icon: <Link2 className="w-4 h-4" />, title: t("quickStart.createLink"), desc: t("quickStart.createLinkDesc"), href: "/links/new" },
              { icon: <Megaphone className="w-4 h-4" />, title: t("quickStart.setupCampaign"), desc: t("quickStart.setupCampaignDesc"), href: "/campaigns" },
              { icon: <FileText className="w-4 h-4" />, title: t("quickStart.createTemplate"), desc: t("quickStart.createTemplateDesc"), href: "/templates" },
            ].map((step, i) => (
              <Link
                key={i}
                href={step.href}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                  {step.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700">{step.title}</p>
                  <p className="text-xs text-slate-400">{step.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
