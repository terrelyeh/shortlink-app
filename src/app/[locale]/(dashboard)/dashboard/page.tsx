import { getTranslations } from "next-intl/server";
import { Link2, MousePointerClick, Users, TrendingUp, Plus, ArrowRight, Megaphone, FileText, Zap, ExternalLink } from "lucide-react";
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
  const [totalLinks, activeLinks] = await Promise.all([
    prisma.shortLink.count({ where: whereClause }),
    prisma.shortLink.count({ where: { ...whereClause, status: "ACTIVE" } }),
  ]);

  // Get click stats for last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  // Get link IDs for the user
  const userLinks = await prisma.shortLink.findMany({
    where: whereClause,
    select: { id: true },
  });
  const linkIds = userLinks.map((l: { id: string }) => l.id);

  // Current period clicks (last 30 days)
  const currentPeriodClicks = linkIds.length > 0 ? await prisma.click.count({
    where: {
      shortLinkId: { in: linkIds },
      timestamp: { gte: thirtyDaysAgo },
    },
  }) : 0;

  // Previous period clicks (30-60 days ago)
  const previousPeriodClicks = linkIds.length > 0 ? await prisma.click.count({
    where: {
      shortLinkId: { in: linkIds },
      timestamp: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
    },
  }) : 0;

  // Unique visitors (by ipHash)
  const uniqueVisitors = linkIds.length > 0 ? await prisma.click.groupBy({
    by: ['ipHash'],
    where: {
      shortLinkId: { in: linkIds },
      timestamp: { gte: thirtyDaysAgo },
    },
  }).then((results: { ipHash: string | null }[]) => results.length) : 0;

  // Calculate trend
  const clicksTrend = previousPeriodClicks > 0
    ? ((currentPeriodClicks - previousPeriodClicks) / previousPeriodClicks) * 100
    : 0;

  return {
    totalClicks: currentPeriodClicks,
    uniqueVisitors,
    totalLinks,
    activeLinks,
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
    },
    orderBy: {
      clicks: {
        _count: 'desc',
      },
    },
    take: limit,
  });

  return links.map((link: { id: string; code: string; originalUrl: string; _count: { clicks: number } }) => ({
    id: link.id,
    code: link.code,
    originalUrl: link.originalUrl,
    clicks: link._count.clicks,
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
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });

  return links.map((link: { id: string; code: string; originalUrl: string; createdAt: Date; _count: { clicks: number } }) => ({
    id: link.id,
    code: link.code,
    originalUrl: link.originalUrl,
    clicks: link._count.clicks,
    createdAt: link.createdAt,
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
      _count: { select: { clicks: true } },
    },
  });

  // Aggregate by campaign name
  const campaignMap = new Map<string, { linkCount: number; clickCount: number }>();
  links.forEach((link: { utmCampaign: string | null; _count: { clicks: number } }) => {
    if (!link.utmCampaign) return;
    const existing = campaignMap.get(link.utmCampaign);
    if (existing) {
      existing.linkCount++;
      existing.clickCount += link._count.clicks;
    } else {
      campaignMap.set(link.utmCampaign, { linkCount: 1, clickCount: link._count.clicks });
    }
  });

  return Array.from(campaignMap.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.clickCount - a.clickCount)
    .slice(0, limit);
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

      {/* Inline Stats Row */}
      <div className="flex items-start gap-8 pb-6 border-b border-slate-100">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">{t("totalClicks")}</p>
          <p className="text-3xl font-semibold text-slate-900 mt-1">{stats.totalClicks.toLocaleString()}</p>
          {stats.clicksTrend !== 0 && (
            <p className={`text-xs mt-1 ${stats.clicksTrend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {stats.clicksTrend >= 0 ? "+" : ""}{t("vsLastPeriod", { value: stats.clicksTrend })}
            </p>
          )}
        </div>
        <div className="border-l border-slate-100 pl-8">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">{t("uniqueVisitors")}</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{stats.uniqueVisitors.toLocaleString()}</p>
        </div>
        <div className="border-l border-slate-100 pl-8">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">{t("totalLinks")}</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{stats.totalLinks}</p>
        </div>
        <div className="border-l border-slate-100 pl-8">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">{t("activeLinks")}</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{stats.activeLinks}</p>
        </div>
      </div>

      {/* Top Links */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wider">{t("topLinks")}</h2>
          <Link href="/links" className="text-xs text-[#03A9F4] hover:text-[#0288D1] font-medium">
            {t("viewAll")}
          </Link>
        </div>
        {topLinks.length > 0 ? (
          <div className="bg-white rounded-xl border border-slate-100">
            {topLinks.map((link: { id: string; code: string; originalUrl: string; clicks: number }, index: number) => (
              <div
                key={link.id}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${
                  index > 0 ? "border-t border-slate-100" : ""
                }`}
              >
                <span className="w-5 h-5 rounded text-xs font-medium flex items-center justify-center text-slate-400">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">/{link.code}</p>
                  <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    {link.originalUrl}
                  </p>
                </div>
                <span className="text-sm font-medium text-slate-600 tabular-nums">
                  {link.clicks.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 py-4">{t("noLinksYet")}</p>
        )}
      </div>

      {/* Recent Links */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wider">{t("recentLinks")}</h2>
          <Link href="/links" className="text-xs text-[#03A9F4] hover:text-[#0288D1] font-medium">
            {t("viewAll")}
          </Link>
        </div>
        {recentLinks.length > 0 ? (
          <div className="bg-white rounded-xl border border-slate-100">
            {recentLinks.map((link: { id: string; code: string; originalUrl: string; clicks: number; createdAt: Date }, index: number) => (
              <div
                key={link.id}
                className={`flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors ${
                  index > 0 ? "border-t border-slate-100" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">/{link.code}</p>
                  <p className="text-xs text-slate-400 truncate">{link.originalUrl}</p>
                </div>
                <span className="text-xs text-slate-400 tabular-nums shrink-0">
                  {t("clicksCount", { count: link.clicks })}
                </span>
                <span className="text-xs text-slate-400 tabular-nums shrink-0">
                  {new Date(link.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 py-4">{t("noLinksYet")}</p>
        )}
      </div>

      {/* Top Campaigns */}
      {topCampaigns.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wider">{t("topCampaigns")}</h2>
            <Link href="/campaigns" className="text-xs text-[#03A9F4] hover:text-[#0288D1] font-medium">
              {t("viewAll")}
            </Link>
          </div>
          <div className="bg-white rounded-xl border border-slate-100">
            {topCampaigns.map((campaign: { name: string; linkCount: number; clickCount: number }, index: number) => (
              <div
                key={campaign.name}
                className={`flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors ${
                  index > 0 ? "border-t border-slate-100" : ""
                }`}
              >
                <Megaphone className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="flex-1 font-mono text-sm text-slate-900 truncate">{campaign.name}</span>
                <span className="text-xs text-slate-400 shrink-0">{campaign.linkCount} links</span>
                <span className="text-sm font-medium text-slate-600 tabular-nums shrink-0">{campaign.clickCount.toLocaleString()}</span>
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
