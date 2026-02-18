import { getTranslations } from "next-intl/server";
import { Link2, MousePointerClick, Users, TrendingUp, Plus, ArrowRight, Megaphone, FileText, Zap } from "lucide-react";
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

function StatCard({
  title,
  value,
  icon,
  trend,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean; label: string };
}) {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
          {trend && trend.value !== 0 && (
            <p
              className={`text-xs mt-1 ${
                trend.isPositive ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {trend.isPositive ? "+" : ""}{trend.label}
            </p>
          )}
        </div>
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
          {icon}
        </div>
      </div>
    </div>
  );
}

// Quick Start Guide for new users
function QuickStartGuide({ t }: { t: (key: string) => string }) {
  const steps = [
    {
      icon: <Link2 className="w-5 h-5" />,
      title: t("quickStart.createLink"),
      description: t("quickStart.createLinkDesc"),
      href: "/links/new",
      color: "text-slate-600 bg-slate-100",
    },
    {
      icon: <Megaphone className="w-5 h-5" />,
      title: t("quickStart.setupCampaign"),
      description: t("quickStart.setupCampaignDesc"),
      href: "/campaigns",
      color: "text-slate-600 bg-slate-100",
    },
    {
      icon: <FileText className="w-5 h-5" />,
      title: t("quickStart.createTemplate"),
      description: t("quickStart.createTemplateDesc"),
      href: "/templates",
      color: "text-slate-600 bg-slate-100",
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">{t("quickStart.title")}</h2>
      <p className="text-sm text-slate-500 mb-4">{t("quickStart.description")}</p>
      <div className="space-y-3">
        {steps.map((step, index) => (
          <Link
            key={index}
            href={step.href}
            className="flex items-center gap-4 p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors group"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${step.color}`}>
              {step.icon}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900">{step.title}</p>
              <p className="text-xs text-slate-500">{step.description}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// Empty state component
function EmptyState({ t }: { t: (key: string) => string }) {
  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="text-center py-8">
        <div className="w-14 h-14 mx-auto mb-4 bg-[#03A9F4] rounded-xl flex items-center justify-center">
          <Zap className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">
          {t("emptyState.title")}
        </h1>
        <p className="text-slate-500 max-w-md mx-auto">
          {t("emptyState.description")}
        </p>
      </div>

      {/* Quick Start */}
      <div className="max-w-lg mx-auto">
        <QuickStartGuide t={t} />
      </div>
    </div>
  );
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
    return <EmptyState t={t} />;
  }

  return (
    <div className="space-y-6">
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

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t("totalClicks")}
          value={stats.totalClicks.toLocaleString()}
          icon={<MousePointerClick className="w-5 h-5" />}
          trend={{ value: stats.clicksTrend, isPositive: stats.clicksTrend >= 0, label: t("vsLastPeriod", { value: stats.clicksTrend }) }}
        />
        <StatCard
          title={t("uniqueVisitors")}
          value={stats.uniqueVisitors.toLocaleString()}
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          title={t("totalLinks")}
          value={stats.totalLinks}
          icon={<Link2 className="w-5 h-5" />}
        />
        <StatCard
          title={t("activeLinks")}
          value={stats.activeLinks}
          icon={<TrendingUp className="w-5 h-5" />}
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Links */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">{t("topLinks")}</h2>
            <Link href="/links" className="text-sm text-[#03A9F4] hover:text-[#0288D1] font-medium">
              {t("viewAll")}
            </Link>
          </div>
          {topLinks.length > 0 ? (
            <div className="space-y-2">
              {topLinks.map((link: { id: string; code: string; originalUrl: string; clicks: number }, index: number) => (
                <div
                  key={link.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <span className="w-6 h-6 rounded text-xs font-medium flex items-center justify-center bg-slate-100 text-slate-600">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">/{link.code}</p>
                    <p className="text-xs text-slate-500 truncate">{link.originalUrl}</p>
                  </div>
                  <span className="text-sm font-medium text-slate-900">
                    {link.clicks.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-slate-500">
              {t("noLinksYet")}
            </div>
          )}
        </div>

        {/* Quick Start */}
        <QuickStartGuide t={t} />
      </div>

      {/* Top Campaigns */}
      {topCampaigns.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[#03A9F4]" />
              <h2 className="font-semibold text-slate-900">{t("topCampaigns")}</h2>
            </div>
            <Link href="/campaigns" className="text-sm text-[#03A9F4] hover:text-[#0288D1] font-medium">
              {t("viewAll")}
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-slate-500 border-b border-slate-100">
                  <th className="pb-2 font-medium">Campaign</th>
                  <th className="pb-2 font-medium text-right">Links</th>
                  <th className="pb-2 font-medium text-right">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {topCampaigns.map((campaign: { name: string; linkCount: number; clickCount: number }) => (
                  <tr key={campaign.name} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-2.5">
                      <span className="font-mono text-sm text-slate-900">{campaign.name}</span>
                    </td>
                    <td className="py-2.5 text-right text-sm text-slate-600">{campaign.linkCount}</td>
                    <td className="py-2.5 text-right text-sm font-medium text-slate-900">{campaign.clickCount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Links */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">{t("recentLinks")}</h2>
          <Link href="/links" className="text-sm text-[#03A9F4] hover:text-[#0288D1] font-medium">
            View all
          </Link>
        </div>
        {recentLinks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentLinks.map((link: { id: string; code: string; originalUrl: string; clicks: number; createdAt: Date }) => (
              <div
                key={link.id}
                className="p-3 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors"
              >
                <p className="text-sm font-medium text-slate-900 truncate">/{link.code}</p>
                <p className="text-xs text-slate-500 truncate mt-0.5">{link.originalUrl}</p>
                <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                  <span>{t("clicksCount", { count: link.clicks })}</span>
                  <span>{new Date(link.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-slate-500">
            No links yet
          </div>
        )}
      </div>
    </div>
  );
}
