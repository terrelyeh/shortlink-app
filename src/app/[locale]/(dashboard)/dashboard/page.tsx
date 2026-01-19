import { getTranslations } from "next-intl/server";
import { Link2, MousePointerClick, Users, TrendingUp, Plus, Sparkles } from "lucide-react";
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
  const whereClause = isAdminOrManager ? { deletedAt: null } : { userId, deletedAt: null };

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
  const linkIds = userLinks.map(l => l.id);

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
  }).then(results => results.length) : 0;

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
  const whereClause = isAdminOrManager ? { deletedAt: null } : { userId, deletedAt: null };

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

  return links.map(link => ({
    id: link.id,
    code: link.code,
    originalUrl: link.originalUrl,
    clicks: link._count.clicks,
  }));
}

// Get recent links
async function getRecentLinks(userId: string, userRole: string, limit = 5) {
  const isAdminOrManager = userRole === "ADMIN" || userRole === "MANAGER";
  const whereClause = isAdminOrManager ? { deletedAt: null } : { userId, deletedAt: null };

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

  return links.map(link => ({
    id: link.id,
    code: link.code,
    originalUrl: link.originalUrl,
    clicks: link._count.clicks,
    createdAt: link.createdAt,
  }));
}

function StatCard({
  title,
  value,
  icon,
  trend,
  gradient,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  gradient?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-6 shadow-lg border border-white/20 ${gradient || 'bg-white'}`}>
      <div className="flex items-center justify-between relative z-10">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {trend && trend.value !== 0 && (
            <p
              className={`text-sm font-medium mt-2 ${
                trend.isPositive ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}% vs last period
            </p>
          )}
        </div>
        <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
          {icon}
        </div>
      </div>
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100/40 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
    </div>
  );
}

// Empty state component
function EmptyState({ t }: { t: (key: string) => string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          {t("emptyState.title") || "Welcome to Short Link Manager!"}
        </h2>
        <p className="text-gray-600 mb-8">
          {t("emptyState.description") || "Create your first short link to start tracking clicks and analyzing your traffic."}
        </p>
        <Link
          href="/links/new"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
        >
          <Plus className="w-5 h-5" />
          {t("emptyState.createButton") || "Create Your First Link"}
        </Link>
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
  const [stats, topLinks, recentLinks] = await Promise.all([
    getDashboardStats(userId, userRole),
    getTopLinks(userId, userRole),
    getRecentLinks(userId, userRole),
  ]);

  // Show empty state if no links
  if (stats.totalLinks === 0) {
    return <EmptyState t={t} />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-gray-500 mt-1">Overview of your link performance</p>
        </div>
        <Link
          href="/links/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg shadow hover:shadow-lg transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          New Link
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title={t("totalClicks")}
          value={stats.totalClicks.toLocaleString()}
          icon={<MousePointerClick className="w-6 h-6 text-white" />}
          trend={{ value: stats.clicksTrend, isPositive: stats.clicksTrend >= 0 }}
        />
        <StatCard
          title={t("uniqueVisitors")}
          value={stats.uniqueVisitors.toLocaleString()}
          icon={<Users className="w-6 h-6 text-white" />}
        />
        <StatCard
          title={t("totalLinks")}
          value={stats.totalLinks}
          icon={<Link2 className="w-6 h-6 text-white" />}
        />
        <StatCard
          title={t("activeLinks")}
          value={stats.activeLinks}
          icon={<TrendingUp className="w-6 h-6 text-white" />}
        />
      </div>

      {/* Top Links & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Links */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">{t("topLinks")}</h2>
            <Link href="/links" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View all →
            </Link>
          </div>
          {topLinks.length > 0 ? (
            <div className="space-y-4">
              {topLinks.map((link, index) => (
                <div
                  key={link.id}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      /{link.code}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {link.originalUrl}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-gray-900">
                      {link.clicks.toLocaleString()}
                    </span>
                    <p className="text-xs text-gray-500">clicks</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No links yet. Create your first link!
            </div>
          )}
        </div>

        {/* Recent Links */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">{t("recentLinks")}</h2>
            <Link href="/links" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View all →
            </Link>
          </div>
          {recentLinks.length > 0 ? (
            <div className="space-y-4">
              {recentLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Link2 className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      /{link.code}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(link.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900">
                      {link.clicks.toLocaleString()} clicks
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No links yet. Create your first link!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
