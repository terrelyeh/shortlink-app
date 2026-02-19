"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ClicksChart } from "@/components/analytics/ClicksChart";
import { PieChartComponent } from "@/components/analytics/PieChartComponent";
import { MousePointerClick, Users, TrendingUp, Loader2, Link2, ChevronDown, X, Target, Globe, Megaphone, Download, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { CampaignFilter } from "@/components/campaigns/CampaignFilter";

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
  utm: {
    campaigns: { name: string; clicks: number }[];
    sources: { name: string; clicks: number }[];
    mediums: { name: string; clicks: number }[];
    campaignSource: { campaign: string; source: string; clicks: number }[];
    campaignContent: { campaign: string; content: string; clicks: number }[];
  };
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
  { value: "custom", label: "Custom" },
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
    <div className="bg-white rounded-xl p-5 border border-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">{title}</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
          {change !== undefined && change !== 0 && (
            <p className={`text-xs mt-1 ${change > 0 ? "text-emerald-600" : "text-red-500"}`}>
              {change > 0 ? "+" : ""}{change}% vs previous period
            </p>
          )}
        </div>
        <div className={`p-2.5 rounded-xl ${iconBg || "bg-sky-100"}`}>{icon}</div>
      </div>
    </div>
  );
}

// Section divider component
function SectionDivider({ title, id }: { title: string; id: string }) {
  return (
    <div id={id} className="flex items-center gap-3 pt-2 scroll-mt-6">
      <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">{title}</h2>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

// Collapsible section wrapper for empty data
function CollapsibleSection({
  title,
  hasData,
  children,
}: {
  title: string;
  hasData: boolean;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(!hasData ? false : true);

  if (hasData) return <>{children}</>;

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="w-full flex items-center gap-2 py-3 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-left hover:bg-slate-50 transition-colors"
    >
      <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
      <span className="text-sm text-slate-500">{title}</span>
      <span className="text-xs text-slate-400 ml-1">— No data</span>
    </button>
  );
}

export default function AnalyticsPage() {
  const t = useTranslations("analytics");
  const [range, setRange] = useState("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [selectedLinkId, setSelectedLinkId] = useState<string>("");
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch links for the selector (filtered by campaign when selected)
  useEffect(() => {
    async function fetchLinks() {
      setLoadingLinks(true);
      try {
        const params = new URLSearchParams({ limit: "100" });
        if (selectedCampaign) params.set("campaign", selectedCampaign);
        const response = await fetch(`/api/links?${params}`);
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
  }, [selectedCampaign]);

  // Fetch analytics data
  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ range });
        if (selectedCampaign) {
          params.set("campaign", selectedCampaign);
        }
        if (selectedLinkId) {
          params.set("linkId", selectedLinkId);
        }
        if (range === "custom" && customFrom) {
          params.set("from", customFrom);
          if (customTo) params.set("to", customTo);
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
  }, [range, selectedCampaign, selectedLinkId, customFrom, customTo]);

  const handleCampaignChange = (value: string) => {
    setSelectedCampaign(value);
    setSelectedLinkId(""); // Reset link selection when campaign changes
  };

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
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            <div className="flex gap-2 items-center">
              <a
                href={`/api/export/analytics?range=${range}${selectedCampaign ? `&campaign=${selectedCampaign}` : ""}${selectedLinkId ? `&linkId=${selectedLinkId}` : ""}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                CSV
              </a>
              {dateRanges.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRange(r.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    range === r.value
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          }
        />

        {/* Custom Date Range Picker */}
        {range === "custom" && (
          <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="text-sm text-slate-600">From:</label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
            />
            <label className="text-sm text-slate-600">To:</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
            />
          </div>
        )}

        {/* Campaign & Link Filters */}
        <div className="bg-white rounded-xl p-4 border border-slate-100">
          <div className="flex flex-col gap-3">
            {/* Campaign Filter Row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Megaphone className="w-4 h-4" />
                <span className="font-medium">Campaign:</span>
              </div>
              <div className="flex-1 flex items-center gap-2">
                <CampaignFilter
                  value={selectedCampaign}
                  onChange={handleCampaignChange}
                  showNoCampaign
                />
                {selectedCampaign && (
                  <span className="text-xs text-sky-600 bg-sky-50 px-2 py-1 rounded-lg font-mono">
                    {selectedCampaign === "__none__" ? "No Campaign" : selectedCampaign}
                  </span>
                )}
              </div>
            </div>

            {/* Link Filter Row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Link2 className="w-4 h-4" />
                <span className="font-medium">Link:</span>
              </div>

              <div className="flex-1 flex items-center gap-2">
                <div className="relative flex-1 max-w-md">
                  <select
                    value={selectedLinkId}
                    onChange={(e) => setSelectedLinkId(e.target.value)}
                    disabled={loadingLinks}
                    className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] appearance-none bg-white text-slate-700 disabled:opacity-50"
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
          </div>

          {/* Selected Link Info */}
          {selectedLink && (
            <div className="mt-3 p-3 bg-sky-50 rounded-lg border border-sky-100">
              <p className="text-sm text-sky-700">
                <span className="font-semibold">Viewing analytics for:</span>{" "}
                <span className="font-mono">/{selectedLink.code}</span>
                {selectedLink.title && (
                  <span className="text-[#03A9F4]"> ({selectedLink.title})</span>
                )}
              </p>
              <p className="text-xs text-sky-500 mt-1 truncate">
                {selectedLink.originalUrl}
              </p>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : data ? (
        <>
          {/* Anchor Nav */}
          <div className="flex items-center gap-1 pb-2 border-b border-slate-100">
            {[
              { id: "overview", label: t("sections.overview") },
              { id: "audience", label: t("sections.audience") },
              { id: "traffic", label: t("sections.traffic") },
              { id: "campaigns", label: t("sections.campaigns") },
            ].map((section) => (
              <button
                key={section.id}
                onClick={() => document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth" })}
                className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
              >
                {section.label}
              </button>
            ))}
          </div>

          {/* — Overview — */}
          <SectionDivider title={t("sections.overview")} id="overview" />

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title={t("clicks")}
              value={data.summary.totalClicks.toLocaleString()}
              icon={<MousePointerClick className="w-6 h-6 text-[#03A9F4]" />}
              iconBg="bg-sky-100"
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
          <div className="bg-white rounded-xl p-6 border border-slate-100">
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

          {/* — Audience — */}
          <SectionDivider title={t("sections.audience")} id="audience" />

          {/* Distribution Charts — 2-col for better readability */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 border border-slate-100">
              <PieChartComponent data={data.devices} title={t("devices")} />
            </div>
            <div className="bg-white rounded-xl p-6 border border-slate-100">
              <PieChartComponent data={data.browsers} title={t("browsers")} />
            </div>
            <div className="bg-white rounded-xl p-6 border border-slate-100">
              <PieChartComponent
                data={data.operatingSystems}
                title={t("operatingSystems")}
              />
            </div>
          </div>

          {/* — Traffic Sources — */}
          <SectionDivider title={t("sections.traffic")} id="traffic" />

          {/* Referrers & Countries */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 border border-slate-100">
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

            <div className="bg-white rounded-xl p-6 border border-slate-100">
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
            <div className="bg-white rounded-xl p-6 border border-slate-100">
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
                            <span className="text-[#03A9F4] font-medium font-mono">
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
                              className="text-sm text-[#03A9F4] hover:text-[#0288D1] font-medium"
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

          {/* — Campaign Performance — */}
          <SectionDivider title={t("sections.campaigns")} id="campaigns" />

          {/* UTM Analytics Section */}
          <div className="space-y-6">

            {/* Empty State when no UTM data */}
            {(!data.utm || (data.utm.campaigns.length === 0 && data.utm.sources.length === 0)) && (
              <div className="bg-white rounded-xl p-8 border border-slate-100 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Target className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{t("utm.emptyState.title")}</h3>
                <p className="text-sm text-slate-500 mb-4 max-w-md mx-auto">{t("utm.emptyState.description")}</p>
                <div className="flex items-center justify-center gap-3">
                  <a
                    href="/links/new"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all font-medium text-sm"
                  >
                    {t("utm.emptyState.createLink")}
                  </a>
                  <a
                    href="/campaigns"
                    className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-all font-medium text-sm"
                  >
                    <Megaphone className="w-4 h-4" />
                    {t("utm.emptyState.manageCampaigns")}
                  </a>
                </div>
              </div>
            )}

            {/* Show UTM data when available */}
            {data.utm && (data.utm.campaigns.length > 0 || data.utm.sources.length > 0) && (
              <>

              {/* Campaign, Source, Medium Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* By Campaign */}
                <div className="bg-white rounded-xl p-6 border border-slate-100">
                  <div className="flex items-center gap-2 mb-4">
                    <Megaphone className="w-5 h-5 text-amber-500" />
                    <h3 className="font-semibold text-slate-900">{t("utm.byCampaign")}</h3>
                  </div>
                  {data.utm.campaigns.length > 0 ? (
                    <div className="space-y-3">
                      {data.utm.campaigns.map((item, i) => {
                        const maxClicks = data.utm.campaigns[0]?.clicks || 1;
                        const percentage = (item.clicks / maxClicks) * 100;
                        return (
                          <div key={i} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-700 font-medium truncate max-w-[150px]" title={item.name}>
                                {item.name}
                              </span>
                              <span className="text-slate-900 font-semibold">
                                {item.clicks.toLocaleString()}
                              </span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-center py-4 text-sm">{t("utm.noCampaignData")}</p>
                  )}
                </div>

                {/* By Source */}
                <div className="bg-white rounded-xl p-6 border border-slate-100">
                  <div className="flex items-center gap-2 mb-4">
                    <Globe className="w-5 h-5 text-cyan-500" />
                    <h3 className="font-semibold text-slate-900">{t("utm.bySource")}</h3>
                  </div>
                  {data.utm.sources.length > 0 ? (
                    <div className="space-y-3">
                      {data.utm.sources.map((item, i) => {
                        const maxClicks = data.utm.sources[0]?.clicks || 1;
                        const percentage = (item.clicks / maxClicks) * 100;
                        return (
                          <div key={i} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-700 font-medium truncate max-w-[150px]" title={item.name}>
                                {item.name}
                              </span>
                              <span className="text-slate-900 font-semibold">
                                {item.clicks.toLocaleString()}
                              </span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-center py-4 text-sm">{t("utm.noSourceData")}</p>
                  )}
                </div>

                {/* By Medium */}
                <div className="bg-white rounded-xl p-6 border border-slate-100">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    <h3 className="font-semibold text-slate-900">{t("utm.byMedium")}</h3>
                  </div>
                  {data.utm.mediums.length > 0 ? (
                    <div className="space-y-3">
                      {data.utm.mediums.map((item, i) => {
                        const maxClicks = data.utm.mediums[0]?.clicks || 1;
                        const percentage = (item.clicks / maxClicks) * 100;
                        return (
                          <div key={i} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-700 font-medium truncate max-w-[150px]" title={item.name}>
                                {item.name}
                              </span>
                              <span className="text-slate-900 font-semibold">
                                {item.clicks.toLocaleString()}
                              </span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-center py-4 text-sm">{t("utm.noMediumData")}</p>
                  )}
                </div>
              </div>

              {/* Campaign × Source Table */}
              {data.utm.campaignSource.length > 0 && (
                <div className="bg-white rounded-xl p-6 border border-slate-100">
                  <h3 className="font-semibold text-slate-900 mb-4">{t("utm.campaignSource")}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-sm text-slate-500 border-b border-slate-100">
                          <th className="pb-3 font-medium">Campaign</th>
                          <th className="pb-3 font-medium">Source</th>
                          <th className="pb-3 font-medium text-right">{t("clicks")}</th>
                          <th className="pb-3 font-medium text-right w-32">{t("utm.performance")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.utm.campaignSource.map((item, i) => {
                          const maxClicks = data.utm.campaignSource[0]?.clicks || 1;
                          const percentage = (item.clicks / maxClicks) * 100;
                          return (
                            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                              <td className="py-3">
                                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-md text-sm font-medium">
                                  {item.campaign}
                                </span>
                              </td>
                              <td className="py-3">
                                <span className="px-2 py-1 bg-cyan-100 text-cyan-700 rounded-md text-sm font-medium">
                                  {item.source}
                                </span>
                              </td>
                              <td className="py-3 text-right font-semibold text-slate-900">
                                {item.clicks.toLocaleString()}
                              </td>
                              <td className="py-3 pl-4">
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-violet-400 to-purple-500 rounded-full"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Campaign × Content Table */}
              {data.utm.campaignContent.length > 0 && (
                <div className="bg-white rounded-xl p-6 border border-slate-100">
                  <h3 className="font-semibold text-slate-900 mb-4">{t("utm.campaignContent")}</h3>
                  <p className="text-sm text-slate-500 mb-4">{t("utm.campaignContentDesc")}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-sm text-slate-500 border-b border-slate-100">
                          <th className="pb-3 font-medium">Campaign</th>
                          <th className="pb-3 font-medium">Content</th>
                          <th className="pb-3 font-medium text-right">{t("clicks")}</th>
                          <th className="pb-3 font-medium text-right w-32">{t("utm.performance")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.utm.campaignContent.map((item, i) => {
                          const maxClicks = data.utm.campaignContent[0]?.clicks || 1;
                          const percentage = (item.clicks / maxClicks) * 100;
                          return (
                            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                              <td className="py-3">
                                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-md text-sm font-medium">
                                  {item.campaign}
                                </span>
                              </td>
                              <td className="py-3">
                                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-sm font-medium">
                                  {item.content}
                                </span>
                              </td>
                              <td className="py-3 text-right font-semibold text-slate-900">
                                {item.clicks.toLocaleString()}
                              </td>
                              <td className="py-3 pl-4">
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-pink-400 to-rose-500 rounded-full"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              </>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
