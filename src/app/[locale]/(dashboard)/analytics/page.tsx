"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ClicksChart } from "@/components/analytics/ClicksChart";
import { PieChartComponent } from "@/components/analytics/PieChartComponent";
import { MousePointerClick, Users, TrendingUp, Loader2, Link2, ChevronDown, X } from "lucide-react";

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

interface ShortLink {
  id: string;
  code: string;
  title: string | null;
  originalUrl: string;
}

const dateRanges = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
];

function StatCard({
  title,
  value,
  icon,
  change,
  iconBg,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: number;
  iconBg?: string;
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {change !== undefined && change !== 0 && (
            <p
              className={`text-sm mt-1 ${
                change > 0 ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {change > 0 ? "+" : ""}
              {change}% vs previous period
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${iconBg || "bg-violet-100"}`}>{icon}</div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const t = useTranslations("analytics");
  const [range, setRange] = useState("7d");
  const [selectedLinkId, setSelectedLinkId] = useState<string>("");
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all links for the selector
  useEffect(() => {
    async function fetchLinks() {
      setLoadingLinks(true);
      try {
        const response = await fetch("/api/links?limit=100");
        if (response.ok) {
          const data = await response.json();
          setLinks(data.links || []);
        }
      } catch (err) {
        console.error("Failed to fetch links:", err);
      } finally {
        setLoadingLinks(false);
      }
    }
    fetchLinks();
  }, []);

  // Fetch analytics data
  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ range });
        if (selectedLinkId) {
          params.set("linkId", selectedLinkId);
        }

        const response = await fetch(`/api/analytics?${params}`);
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
  }, [range, selectedLinkId]);

  const selectedLink = links.find(l => l.id === selectedLinkId);

  if (error) {
    return (
      <div className="p-6 bg-red-50 rounded-xl text-red-700 border border-red-100">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>

          {/* Date Range Selector */}
          <div className="flex gap-2">
            {dateRanges.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  range === r.value
                    ? "bg-slate-900 text-white shadow-lg"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Link Selector */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Link2 className="w-4 h-4" />
              <span className="font-medium">Filter by link:</span>
            </div>

            <div className="flex-1 flex items-center gap-2">
              <div className="relative flex-1 max-w-md">
                <select
                  value={selectedLinkId}
                  onChange={(e) => setSelectedLinkId(e.target.value)}
                  disabled={loadingLinks}
                  className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 appearance-none bg-white text-slate-700 disabled:opacity-50"
                >
                  <option value="">All Links (Aggregated)</option>
                  {links.map((link) => (
                    <option key={link.id} value={link.id}>
                      /{link.code} {link.title ? `- ${link.title}` : ""}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  {loadingLinks ? (
                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>

              {selectedLinkId && (
                <button
                  onClick={() => setSelectedLinkId("")}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Clear filter"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Selected Link Info */}
          {selectedLink && (
            <div className="mt-3 p-3 bg-violet-50 rounded-lg border border-violet-100">
              <p className="text-sm text-violet-700">
                <span className="font-semibold">Viewing analytics for:</span>{" "}
                <span className="font-mono">/{selectedLink.code}</span>
                {selectedLink.title && (
                  <span className="text-violet-600"> ({selectedLink.title})</span>
                )}
              </p>
              <p className="text-xs text-violet-500 mt-1 truncate">
                {selectedLink.originalUrl}
              </p>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-purple-100 rounded-2xl flex items-center justify-center mb-4">
            <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
          </div>
          <p className="text-slate-500">Loading analytics...</p>
        </div>
      ) : data ? (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title={t("clicks")}
              value={data.summary.totalClicks.toLocaleString()}
              icon={<MousePointerClick className="w-6 h-6 text-violet-600" />}
              iconBg="bg-violet-100"
              change={data.summary.clicksChange}
            />
            <StatCard
              title={t("uniqueClicks")}
              value={data.summary.uniqueVisitors.toLocaleString()}
              icon={<Users className="w-6 h-6 text-cyan-600" />}
              iconBg="bg-cyan-100"
            />
            <StatCard
              title="Unique Rate"
              value={
                data.summary.totalClicks > 0
                  ? `${((data.summary.uniqueVisitors / data.summary.totalClicks) * 100).toFixed(1)}%`
                  : "0%"
              }
              icon={<TrendingUp className="w-6 h-6 text-emerald-600" />}
              iconBg="bg-emerald-100"
            />
          </div>

          {/* Clicks Over Time */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Clicks Over Time
            </h2>
            {data.clicksByDay.length > 0 ? (
              <ClicksChart data={data.clicksByDay} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-400">
                {t("noData")}
              </div>
            )}
          </div>

          {/* Distribution Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <PieChartComponent data={data.devices} title={t("devices")} />
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <PieChartComponent data={data.browsers} title={t("browsers")} />
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <PieChartComponent
                data={data.operatingSystems}
                title={t("operatingSystems")}
              />
            </div>
          </div>

          {/* Top Referrers & Countries */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                {t("referrers")}
              </h2>
              {data.referrers.length > 0 ? (
                <div className="space-y-3">
                  {data.referrers.map((referrer, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 truncate flex-1">
                        {referrer.name}
                      </span>
                      <span className="text-sm font-semibold text-slate-900 ml-4">
                        {referrer.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-center py-8">{t("noData")}</p>
              )}
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                {t("countries")}
              </h2>
              {data.countries.length > 0 ? (
                <div className="space-y-3">
                  {data.countries.map((country, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">{country.name}</span>
                      <span className="text-sm font-semibold text-slate-900">
                        {country.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-center py-8">{t("noData")}</p>
              )}
            </div>
          </div>

          {/* Top Links - Only show when viewing all links */}
          {!selectedLinkId && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                Top Performing Links
              </h2>
              {data.topLinks.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-slate-500 border-b border-slate-100">
                        <th className="pb-3 font-medium">Short URL</th>
                        <th className="pb-3 font-medium">Title</th>
                        <th className="pb-3 font-medium text-right">Clicks</th>
                        <th className="pb-3 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topLinks.map((link) => (
                        <tr key={link.id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-3">
                            <span className="text-violet-600 font-medium font-mono">
                              /{link.code}
                            </span>
                          </td>
                          <td className="py-3 text-slate-600 max-w-xs truncate">
                            {link.title || link.originalUrl}
                          </td>
                          <td className="py-3 text-right font-semibold text-slate-900">
                            {link.clicks.toLocaleString()}
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => setSelectedLinkId(link.id)}
                              className="text-sm text-violet-600 hover:text-violet-700 font-medium"
                            >
                              View Details →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-400 text-center py-8">{t("noData")}</p>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
