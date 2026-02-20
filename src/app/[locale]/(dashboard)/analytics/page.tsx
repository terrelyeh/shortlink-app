"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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
  { value: "24h", labelKey: "range24h" },
  { value: "7d", labelKey: "range7d" },
  { value: "30d", labelKey: "range30d" },
  { value: "90d", labelKey: "range90d" },
  { value: "custom", labelKey: "custom" },
];

function StatCard({
  title,
  value,
  icon,
  change,
  changeLabel,
  iconBg,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: number;
  changeLabel?: string;
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
              {change > 0 ? "+" : ""}{change}% {changeLabel}
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

export default function AnalyticsPage() {
  const t = useTranslations("analytics");
  const searchParams = useSearchParams();
  const [range, setRange] = useState("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState<string>(
    searchParams.get("campaign") || ""
  );
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
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <a
            href={`/api/export/analytics?range=${range}${selectedCampaign ? `&campaign=${selectedCampaign}` : ""}${selectedLinkId ? `&linkId=${selectedLinkId}` : ""}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            CSV
          </a>
        }
      />

      {/* Date Range + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Date range segmented control */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
          {dateRanges.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                range === r.value
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t(r.labelKey)}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        {range === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
            />
            <span className="text-sm text-slate-400">–</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
            />
          </div>
        )}

        {/* Campaign filter */}
        <CampaignFilter
          value={selectedCampaign}
          onChange={handleCampaignChange}
          showNoCampaign
        />

        {/* Link selector */}
        <div className="relative flex-1 max-w-xs">
          <select
            value={selectedLinkId}
            onChange={(e) => setSelectedLinkId(e.target.value)}
            disabled={loadingLinks}
            className="w-full appearance-none pl-8 pr-7 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] cursor-pointer disabled:opacity-50"
          >
            <option value="">{t("allLinks")}</option>
            {links.map((link) => (
              <option key={link.id} value={link.id}>
                /{link.code} {link.title ? `- ${link.title}` : ""}
              </option>
            ))}
          </select>
          <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          {loadingLinks ? (
            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin pointer-events-none" />
          ) : (
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          )}
        </div>

        {/* Clear link filter */}
        {selectedLinkId && (
          <button
            onClick={() => setSelectedLinkId("")}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title={t("clearFilter")}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Selected link info — compact callout */}
      {selectedLink && (
        <div className="flex items-center gap-3 bg-sky-50/50 border-l-2 border-[#03A9F4] rounded-r-lg px-4 py-2.5">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-700">
              <span className="font-medium">{t("viewingLinkAnalytics")}</span>{" "}
              <span className="font-mono text-[#03A9F4]">/{selectedLink.code}</span>
              {selectedLink.title && (
                <span className="text-slate-500"> — {selectedLink.title}</span>
              )}
            </p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {selectedLink.originalUrl}
            </p>
          </div>
          <button
            onClick={() => setSelectedLinkId("")}
            className="p-1 hover:bg-sky-100 rounded shrink-0"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      )}

      {/* Campaign Links — shown when a real campaign is selected */}
      {selectedCampaign && selectedCampaign !== "__none__" && (
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-800">
                {t("campaignLinks")}{" "}
                <span className="font-mono text-[#03A9F4]">{selectedCampaign}</span>
              </h3>
              {!loadingLinks && (
                <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full tabular-nums">
                  {links.length}
                </span>
              )}
            </div>
          </div>

          {loadingLinks ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
          ) : links.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">{t("noLinksInCampaign")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pl-4 py-2.5 pr-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      {t("shortUrl")}
                    </th>
                    <th className="py-2.5 pr-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      {t("destination")}
                    </th>
                    <th className="py-2.5 pr-4 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                      {t("action")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((link) => (
                    <tr
                      key={link.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="pl-4 py-2.5 pr-3">
                        <span className="text-[#03A9F4] font-mono text-sm font-medium">
                          /{link.code}
                        </span>
                        {link.title && (
                          <span className="ml-2 text-xs text-slate-400">{link.title}</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 max-w-xs">
                        <span className="text-xs text-slate-500 truncate block" title={link.originalUrl}>
                          {link.originalUrl.replace(/^https?:\/\//, "").substring(0, 60)}
                          {link.originalUrl.length > 63 ? "…" : ""}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-right">
                        <button
                          onClick={() => setSelectedLinkId(link.id)}
                          className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                            selectedLinkId === link.id
                              ? "bg-[#03A9F4] text-white"
                              : "text-[#03A9F4] hover:bg-sky-50"
                          }`}
                        >
                          {selectedLinkId === link.id ? t("viewing") : t("viewDetails")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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
              changeLabel={t("vsPreviousPeriod")}
            />
            <StatCard
              title={t("uniqueClicks")}
              value={data.summary.uniqueVisitors.toLocaleString()}
              icon={<Users className="w-6 h-6 text-cyan-600" />}
              iconBg="bg-cyan-100"
            />
            <StatCard
              title={t("uniqueRate")}
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
          <div className="bg-white rounded-xl p-5 border border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">
              {t("clicksOverTime")}
            </h2>
            {data.clicksByDay.length > 0 ? (
              <ClicksChart data={data.clicksByDay} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-400 text-sm">
                {t("noData")}
              </div>
            )}
          </div>

          {/* — Audience — */}
          <SectionDivider title={t("sections.audience")} id="audience" />

          {/* Distribution Charts — 3-col single row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-100">
              <PieChartComponent data={data.devices} title={t("devices")} />
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-100">
              <PieChartComponent data={data.browsers} title={t("browsers")} />
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-100">
              <PieChartComponent
                data={data.operatingSystems}
                title={t("operatingSystems")}
              />
            </div>
          </div>

          {/* — Traffic Sources — */}
          <SectionDivider title={t("sections.traffic")} id="traffic" />

          {/* Referrers & Countries */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-5 border border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">
                {t("referrers")}
              </h2>
              {data.referrers.length > 0 ? (
                <div className="space-y-2.5">
                  {data.referrers.map((referrer, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 truncate flex-1">
                        {referrer.name}
                      </span>
                      <span className="text-sm font-medium text-slate-900 ml-4 tabular-nums">
                        {referrer.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-center py-8 text-sm">{t("noData")}</p>
              )}
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">
                {t("countries")}
              </h2>
              {data.countries.length > 0 ? (
                <div className="space-y-2.5">
                  {data.countries.map((country, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">{country.name}</span>
                      <span className="text-sm font-medium text-slate-900 tabular-nums">
                        {country.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-center py-8 text-sm">{t("noData")}</p>
              )}
            </div>
          </div>

          {/* Top Links - Only show when viewing all links */}
          {!selectedLinkId && (
            <div className="bg-white rounded-xl border border-slate-100">
              <div className="px-4 py-3 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">
                  {t("topPerformingLinks")}
                </h2>
              </div>
              {data.topLinks.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pl-4 py-2.5 pr-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          {t("shortUrl")}
                        </th>
                        <th className="py-2.5 pr-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          {t("linkTitle")}
                        </th>
                        <th className="py-2.5 pr-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                          {t("clicks")}
                        </th>
                        <th className="py-2.5 pr-4 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                          {t("action")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topLinks.map((link) => (
                        <tr key={link.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="pl-4 py-2.5 pr-3">
                            <span className="text-[#03A9F4] font-medium font-mono text-sm">
                              /{link.code}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-sm text-slate-600 max-w-xs truncate">
                            {link.title || link.originalUrl}
                          </td>
                          <td className="py-2.5 pr-3 text-right text-sm font-medium text-slate-900 tabular-nums">
                            {link.clicks.toLocaleString()}
                          </td>
                          <td className="py-2.5 pr-4 text-right">
                            <button
                              onClick={() => setSelectedLinkId(link.id)}
                              className="text-xs text-[#03A9F4] hover:text-[#0288D1] font-medium"
                            >
                              {t("viewDetails")} →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-400 text-center py-8 text-sm">{t("noData")}</p>
              )}
            </div>
          )}

          {/* — Campaign Performance — */}
          <SectionDivider title={t("sections.campaigns")} id="campaigns" />

          {/* UTM Analytics Section */}
          <div className="space-y-4">

            {/* Empty State when no UTM data */}
            {(!data.utm || (data.utm.campaigns.length === 0 && data.utm.sources.length === 0)) && (
              <div className="bg-white rounded-xl p-8 border border-slate-100 text-center">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Target className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 mb-1">{t("utm.emptyState.title")}</h3>
                <p className="text-sm text-slate-500 mb-4 max-w-md mx-auto">{t("utm.emptyState.description")}</p>
                <div className="flex items-center justify-center gap-3">
                  <a
                    href="/links/new"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#03A9F4] text-white rounded-lg hover:bg-[#0288D1] transition-colors font-medium text-sm"
                  >
                    {t("utm.emptyState.createLink")}
                  </a>
                  <a
                    href="/campaigns"
                    className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm"
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* By Campaign */}
                <div className="bg-white rounded-xl p-5 border border-slate-100">
                  <div className="flex items-center gap-2 mb-4">
                    <Megaphone className="w-4 h-4 text-amber-500" />
                    <h3 className="text-sm font-semibold text-slate-900">{t("utm.byCampaign")}</h3>
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
                              <span className="text-slate-900 font-medium tabular-nums">
                                {item.clicks.toLocaleString()}
                              </span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-400 rounded-full"
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
                <div className="bg-white rounded-xl p-5 border border-slate-100">
                  <div className="flex items-center gap-2 mb-4">
                    <Globe className="w-4 h-4 text-cyan-500" />
                    <h3 className="text-sm font-semibold text-slate-900">{t("utm.bySource")}</h3>
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
                              <span className="text-slate-900 font-medium tabular-nums">
                                {item.clicks.toLocaleString()}
                              </span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-cyan-400 rounded-full"
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
                <div className="bg-white rounded-xl p-5 border border-slate-100">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-sm font-semibold text-slate-900">{t("utm.byMedium")}</h3>
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
                              <span className="text-slate-900 font-medium tabular-nums">
                                {item.clicks.toLocaleString()}
                              </span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-400 rounded-full"
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
                <div className="bg-white rounded-xl border border-slate-100">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-900">{t("utm.campaignSource")}</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="pl-4 py-2.5 pr-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                            {t("utm.campaign")}
                          </th>
                          <th className="py-2.5 pr-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                            {t("utm.source")}
                          </th>
                          <th className="py-2.5 pr-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                            {t("clicks")}
                          </th>
                          <th className="py-2.5 pr-4 text-right text-xs font-medium text-slate-400 uppercase tracking-wider w-28">
                            {t("utm.performance")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.utm.campaignSource.map((item, i) => {
                          const maxClicks = data.utm.campaignSource[0]?.clicks || 1;
                          const percentage = (item.clicks / maxClicks) * 100;
                          return (
                            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                              <td className="pl-4 py-2.5 pr-3">
                                <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-medium border border-amber-100">
                                  {item.campaign}
                                </span>
                              </td>
                              <td className="py-2.5 pr-3">
                                <span className="px-1.5 py-0.5 bg-cyan-50 text-cyan-700 rounded text-xs font-medium border border-cyan-100">
                                  {item.source}
                                </span>
                              </td>
                              <td className="py-2.5 pr-3 text-right text-sm font-medium text-slate-900 tabular-nums">
                                {item.clicks.toLocaleString()}
                              </td>
                              <td className="py-2.5 pr-4">
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-violet-400 rounded-full"
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
                <div className="bg-white rounded-xl border border-slate-100">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-900">{t("utm.campaignContent")}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{t("utm.campaignContentDesc")}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="pl-4 py-2.5 pr-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                            {t("utm.campaign")}
                          </th>
                          <th className="py-2.5 pr-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                            {t("utm.content")}
                          </th>
                          <th className="py-2.5 pr-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                            {t("clicks")}
                          </th>
                          <th className="py-2.5 pr-4 text-right text-xs font-medium text-slate-400 uppercase tracking-wider w-28">
                            {t("utm.performance")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.utm.campaignContent.map((item, i) => {
                          const maxClicks = data.utm.campaignContent[0]?.clicks || 1;
                          const percentage = (item.clicks / maxClicks) * 100;
                          return (
                            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                              <td className="pl-4 py-2.5 pr-3">
                                <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-medium border border-amber-100">
                                  {item.campaign}
                                </span>
                              </td>
                              <td className="py-2.5 pr-3">
                                <span className="px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded text-xs font-medium border border-violet-100">
                                  {item.content}
                                </span>
                              </td>
                              <td className="py-2.5 pr-3 text-right text-sm font-medium text-slate-900 tabular-nums">
                                {item.clicks.toLocaleString()}
                              </td>
                              <td className="py-2.5 pr-4">
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-rose-400 rounded-full"
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
