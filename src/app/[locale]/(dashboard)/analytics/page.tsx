"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ClicksChart } from "@/components/analytics/ClicksChart";
import { PieChartComponent } from "@/components/analytics/PieChartComponent";
import { MousePointerClick, Users, TrendingUp, Loader2 } from "lucide-react";

interface AnalyticsData {
  summary: {
    totalClicks: number;
    uniqueVisitors: number;
    clicksChange: number;
  };
  clicksByDay: { date: string; clicks: number }[];
  devices: { name: string; value: number }[];
  browsers: { name: string; value: number }[];
  operatingSystems: { name: string; value: number }[];
  referrers: { name: string; value: number }[];
  countries: { name: string; value: number }[];
  topLinks: {
    id: string;
    code: string;
    title: string;
    originalUrl: string;
    clicks: number;
  }[];
}

const dateRanges = [
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
];

function StatCard({
  title,
  value,
  icon,
  change,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: number;
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change !== undefined && change !== 0 && (
            <p
              className={`text-sm mt-1 ${
                change > 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {change > 0 ? "+" : ""}
              {change}% vs previous period
            </p>
          )}
        </div>
        <div className="p-3 bg-blue-50 rounded-lg">{icon}</div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const t = useTranslations("analytics");
  const [range, setRange] = useState("7d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/analytics?range=${range}`);
        if (!response.ok) throw new Error("Failed to fetch analytics");
        const data = await response.json();
        setData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [range]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 rounded-lg text-red-700">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <div className="flex gap-2">
          {dateRanges.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                range === r.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title={t("clicks")}
          value={data.summary.totalClicks.toLocaleString()}
          icon={<MousePointerClick className="w-6 h-6 text-blue-600" />}
          change={data.summary.clicksChange}
        />
        <StatCard
          title={t("uniqueClicks")}
          value={data.summary.uniqueVisitors.toLocaleString()}
          icon={<Users className="w-6 h-6 text-blue-600" />}
        />
        <StatCard
          title="Click Rate"
          value={
            data.summary.totalClicks > 0
              ? `${((data.summary.uniqueVisitors / data.summary.totalClicks) * 100).toFixed(1)}%`
              : "0%"
          }
          icon={<TrendingUp className="w-6 h-6 text-blue-600" />}
        />
      </div>

      {/* Clicks Over Time */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Clicks Over Time
        </h2>
        {data.clicksByDay.length > 0 ? (
          <ClicksChart data={data.clicksByDay} />
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-400">
            {t("noData")}
          </div>
        )}
      </div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <PieChartComponent data={data.devices} title={t("devices")} />
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <PieChartComponent data={data.browsers} title={t("browsers")} />
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <PieChartComponent
            data={data.operatingSystems}
            title={t("operatingSystems")}
          />
        </div>
      </div>

      {/* Top Referrers & Countries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t("referrers")}
          </h2>
          {data.referrers.length > 0 ? (
            <div className="space-y-3">
              {data.referrers.map((referrer, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 truncate flex-1">
                    {referrer.name}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 ml-4">
                    {referrer.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">{t("noData")}</p>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t("countries")}
          </h2>
          {data.countries.length > 0 ? (
            <div className="space-y-3">
              {data.countries.map((country, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{country.name}</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {country.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">{t("noData")}</p>
          )}
        </div>
      </div>

      {/* Top Links */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Top Performing Links
        </h2>
        {data.topLinks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-3 font-medium">Short URL</th>
                  <th className="pb-3 font-medium">Title</th>
                  <th className="pb-3 font-medium text-right">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {data.topLinks.map((link) => (
                  <tr key={link.id} className="border-b border-gray-50">
                    <td className="py-3">
                      <span className="text-blue-600 font-medium">
                        /{link.code}
                      </span>
                    </td>
                    <td className="py-3 text-gray-600 max-w-xs truncate">
                      {link.title || link.originalUrl}
                    </td>
                    <td className="py-3 text-right font-semibold">
                      {link.clicks.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400 text-center py-8">{t("noData")}</p>
        )}
      </div>
    </div>
  );
}
