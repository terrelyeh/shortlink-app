import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Link2, MousePointerClick, Users, TrendingUp } from "lucide-react";

export async function generateMetadata() {
  const t = await getTranslations("dashboard");
  return {
    title: t("title"),
  };
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
  trend?: { value: number; isPositive: boolean };
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {trend && (
            <p
              className={`text-sm mt-1 ${
                trend.isPositive ? "text-green-600" : "text-red-600"
              }`}
            >
              {trend.isPositive ? "+" : "-"}
              {Math.abs(trend.value)}% vs last period
            </p>
          )}
        </div>
        <div className="p-3 bg-blue-50 rounded-lg">{icon}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");

  // TODO: Fetch real data from database
  const stats = {
    totalClicks: 12543,
    uniqueVisitors: 8721,
    totalLinks: 156,
    activeLinks: 142,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t("totalClicks")}
          value={stats.totalClicks.toLocaleString()}
          icon={<MousePointerClick className="w-6 h-6 text-blue-600" />}
          trend={{ value: 12.5, isPositive: true }}
        />
        <StatCard
          title={t("uniqueVisitors")}
          value={stats.uniqueVisitors.toLocaleString()}
          icon={<Users className="w-6 h-6 text-blue-600" />}
          trend={{ value: 8.2, isPositive: true }}
        />
        <StatCard
          title={t("totalLinks")}
          value={stats.totalLinks}
          icon={<Link2 className="w-6 h-6 text-blue-600" />}
        />
        <StatCard
          title={t("activeLinks")}
          value={stats.activeLinks}
          icon={<TrendingUp className="w-6 h-6 text-blue-600" />}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t("clicksTrend")}
          </h2>
          <div className="h-64 flex items-center justify-center text-gray-400">
            {/* TODO: Add Recharts LineChart */}
            Chart placeholder
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t("topLinks")}
          </h2>
          <div className="space-y-3">
            {/* TODO: Add real top links data */}
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    /promo-{i}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    https://example.com/very-long-url-{i}
                  </p>
                </div>
                <span className="text-sm font-semibold text-gray-900 ml-4">
                  {(1000 - i * 100).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Links */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {t("recentLinks")}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b">
                <th className="pb-3 font-medium">Short URL</th>
                <th className="pb-3 font-medium">Original URL</th>
                <th className="pb-3 font-medium">Clicks</th>
                <th className="pb-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {/* TODO: Add real recent links data */}
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0">
                  <td className="py-3">
                    <span className="text-blue-600 font-medium">/link-{i}</span>
                  </td>
                  <td className="py-3 text-gray-600 max-w-xs truncate">
                    https://example.com/page-{i}
                  </td>
                  <td className="py-3 text-gray-900">{i * 50}</td>
                  <td className="py-3 text-gray-500 text-sm">
                    {new Date().toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
