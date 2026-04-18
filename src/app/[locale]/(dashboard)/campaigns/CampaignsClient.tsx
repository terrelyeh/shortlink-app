"use client";

/**
 * Campaigns list — the "how's every campaign doing?" hub.
 *
 * Previously this page was a bare table (name / status / link count) and
 * the rich leaderboard sat on Analytics. That left Campaigns feeling
 * empty, and Analytics doing campaign-management work it shouldn't.
 *
 * Now the leaderboard lives here — every campaign row shows windowed
 * clicks, conversions, CVR, and goal progress. Marketers open this page
 * to answer "is spring_sale hitting target? which auto-created utm is
 * surprisingly strong? is there a campaign we should archive?". Analytics
 * is free to be about traffic patterns (devices, geo, referrers).
 *
 * Data lifecycle: fetched once from /api/analytics/campaigns-summary on
 * mount (Redis-cached 60s). Window change → refetch. Search / status /
 * sort are client-side useMemo so they're zero-latency.
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import {
  Megaphone,
  Search,
  Link2,
  Plus,
  Info,
  X,
  Loader2,
  Target,
  BarChart3,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

interface CampaignRow {
  id: string | null;
  name: string;
  displayName: string | null;
  description: string | null;
  status: string | null;
  defaultSource: string | null;
  defaultMedium: string | null;
  linkCount: number;
  clicks: number;
  conversions: number;
  cvr: number;
  goalClicks: number | null;
  goalPct: number | null;
}

interface OrphanRow {
  id: string;
  code: string;
  title: string | null;
  originalUrl: string;
  clicks: number;
  conversions: number;
}

interface SummaryResponse {
  campaigns: CampaignRow[];
  orphans: OrphanRow[];
  meta: {
    days: number;
    totalCampaigns: number;
    totalOrphans: number;
    since: string;
  };
}

type SortKey = "clicks" | "conversions" | "cvr" | "goalPct" | "name";

// Maps our date-range preset to the days query param on the summary API.
const windowPresets: { value: string; labelKey: string; days: number }[] = [
  { value: "7d", labelKey: "last7Days", days: 7 },
  { value: "30d", labelKey: "last30Days", days: 30 },
  { value: "90d", labelKey: "last90Days", days: 90 },
];

function statusDot(status: string | null) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-500";
    case "DRAFT":
      return "bg-slate-300";
    case "COMPLETED":
      return "bg-sky-400";
    case "ARCHIVED":
      return "bg-slate-400";
    default:
      return "bg-slate-300";
  }
}
function statusBg(status: string | null) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "DRAFT":
      return "bg-slate-50 text-slate-600 border-slate-200";
    case "COMPLETED":
      return "bg-sky-50 text-sky-700 border-sky-100";
    case "ARCHIVED":
      return "bg-slate-50 text-slate-400 border-slate-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

export default function CampaignsClient() {
  const t = useTranslations("campaigns");
  const router = useRouter();

  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [window, setWindow] = useState<string>("30d");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("clicks");
  const [showTip, setShowTip] = useState(true);

  const fetchData = useCallback(async () => {
    const preset = windowPresets.find((p) => p.value === window) ?? windowPresets[1];
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/campaigns-summary?days=${preset.days}`);
      if (res.ok) {
        const json = (await res.json()) as SummaryResponse;
        setData(json);
      }
    } catch (err) {
      console.error("campaigns summary fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [window]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived list — search / status / sort all client-side useMemo so
  // keystrokes and tab clicks are instant.
  const campaigns = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    const filtered = data.campaigns.filter((c) => {
      if (statusFilter) {
        if (c.status !== statusFilter) return false;
      } else {
        // Default: hide ARCHIVED; leaderboard should feel "live"
        if (c.status === "ARCHIVED") return false;
      }
      if (q) {
        const hay = [c.name, c.displayName, c.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "cvr") return b.cvr - a.cvr;
      if (sortKey === "conversions") return b.conversions - a.conversions;
      if (sortKey === "goalPct") return (b.goalPct ?? -1) - (a.goalPct ?? -1);
      return b.clicks - a.clicks;
    });
  }, [data, searchQuery, statusFilter, sortKey]);

  const totals = useMemo(() => {
    if (!data) return { clicks: 0, conversions: 0, withGoal: 0 };
    return {
      clicks: data.campaigns.reduce((s, c) => s + c.clicks, 0),
      conversions: data.campaigns.reduce((s, c) => s + c.conversions, 0),
      withGoal: data.campaigns.filter((c) => c.goalClicks).length,
    };
  }, [data]);

  const overallCvr =
    totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <button
            onClick={() => router.push("/links/new")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#03A9F4] text-white text-sm font-medium rounded-lg hover:bg-[#0288D1] transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("createLinkWithUTM")}
          </button>
        }
      />

      {/* Summary strip — fast "is anything on fire?" glance. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Megaphone className="w-4 h-4 text-violet-500" />}
          label="Active campaigns"
          value={
            data
              ? data.campaigns.filter((c) => c.status === "ACTIVE").length.toString()
              : "—"
          }
        />
        <StatCard
          icon={<Link2 className="w-4 h-4 text-slate-400" />}
          label={`Clicks · last ${data?.meta.days ?? 30}d`}
          value={data ? totals.clicks.toLocaleString() : "—"}
        />
        <StatCard
          icon={<Target className="w-4 h-4 text-emerald-500" />}
          label={`Conversions · last ${data?.meta.days ?? 30}d`}
          value={
            data
              ? `${totals.conversions.toLocaleString()}${
                  totals.clicks > 0 ? ` · ${overallCvr.toFixed(1)}% CVR` : ""
                }`
              : "—"
          }
        />
        <StatCard
          icon={<BarChart3 className="w-4 h-4 text-slate-400" />}
          label="Campaigns with a goal"
          value={
            data
              ? `${totals.withGoal} / ${data.campaigns.length}`
              : "—"
          }
        />
      </div>

      {/* Educational callout — only when we have zero data */}
      {showTip && data && data.campaigns.length === 0 && (
        <div className="flex items-start gap-3 bg-sky-50/50 border-l-2 border-[#03A9F4] rounded-r-lg p-4">
          <Info className="w-4 h-4 text-[#03A9F4] mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-slate-700">{t("howItWorks")}</p>
            <button
              onClick={() => router.push("/links/new")}
              className="text-sm font-medium text-[#03A9F4] hover:text-[#0288D1] mt-1"
            >
              {t("createLinkWithUTM")} →
            </button>
          </div>
          <button onClick={() => setShowTip(false)} className="p-1 hover:bg-sky-100 rounded">
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      )}

      {/* Controls: window + search + status + sort */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
          {windowPresets.map((p) => (
            <button
              key={p.value}
              onClick={() => setWindow(p.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                window === p.value
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {p.value}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
          />
        </div>
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
          {["", "ACTIVE", "DRAFT", "COMPLETED", "ARCHIVED"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === status
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {status === ""
                ? t("allStatuses") || "All"
                : status === "ACTIVE"
                  ? t("statusActive")
                  : status === "DRAFT"
                    ? t("statusDraft")
                    : status === "COMPLETED"
                      ? t("statusCompleted")
                      : t("statusArchived")}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-semibold text-slate-900">
              Leaderboard
            </h2>
            <span className="text-xs text-slate-400">· last {data?.meta.days ?? 30}d</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-400 mr-1">Sort</span>
            {(["clicks", "conversions", "cvr", "goalPct", "name"] as SortKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setSortKey(k)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  sortKey === k
                    ? "bg-slate-100 text-slate-900 font-medium"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {k === "goalPct"
                  ? "Goal %"
                  : k === "cvr"
                    ? "CVR"
                    : k === "name"
                      ? "Name"
                      : k.charAt(0).toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            {searchQuery || statusFilter
              ? "No campaigns match your filters."
              : "No campaigns yet. Create a link with a UTM campaign value and it'll show up here."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wider">
                  <th className="pl-4 py-2 pr-3 text-left font-medium">Campaign</th>
                  <th className="py-2 pr-3 text-left font-medium">Status</th>
                  <th className="py-2 pr-3 text-left font-medium">Source / Medium</th>
                  <th className="py-2 pr-3 text-right font-medium">Links</th>
                  <th className="py-2 pr-3 text-right font-medium">Clicks</th>
                  <th className="py-2 pr-3 text-right font-medium">Conv.</th>
                  <th className="py-2 pr-3 text-right font-medium">CVR</th>
                  <th className="py-2 pr-4 text-right font-medium">Goal</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr
                    key={c.name}
                    onClick={() => router.push(`/campaigns/${encodeURIComponent(c.name)}`)}
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer"
                  >
                    <td className="pl-4 py-2.5 pr-3">
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-slate-900 group-hover:text-[#03A9F4] truncate max-w-[240px]">
                          {c.displayName || c.name}
                        </span>
                        {c.displayName && (
                          <span className="text-[10px] font-mono text-slate-400 truncate max-w-[240px]">
                            {c.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      {c.status ? (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${statusBg(c.status)}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDot(c.status)}`} />
                          {c.status === "ACTIVE"
                            ? t("statusActive")
                            : c.status === "DRAFT"
                              ? t("statusDraft")
                              : c.status === "COMPLETED"
                                ? t("statusCompleted")
                                : t("statusArchived")}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300 italic">utm-only</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {c.defaultSource && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-50 text-cyan-700 border border-cyan-100">
                            {c.defaultSource}
                          </span>
                        )}
                        {c.defaultMedium && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-700 border border-violet-100">
                            {c.defaultMedium}
                          </span>
                        )}
                        {!c.defaultSource && !c.defaultMedium && (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700">
                      {c.linkCount}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums font-medium text-slate-900">
                      {c.clicks.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {c.conversions > 0 ? (
                        <span className="font-medium text-emerald-600">
                          {c.conversions.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {c.conversions > 0 ? (
                        <span className="text-emerald-700">{c.cvr.toFixed(1)}%</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      {c.goalPct !== null && c.goalClicks ? (
                        <div className="inline-flex items-center gap-2">
                          <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                c.goalPct >= 100 ? "bg-emerald-500" : "bg-violet-500"
                              }`}
                              style={{ width: `${c.goalPct}%` }}
                            />
                          </div>
                          <span
                            className={`text-xs tabular-nums ${
                              c.goalPct >= 100
                                ? "text-emerald-600 font-medium"
                                : "text-slate-500"
                            }`}
                          >
                            {c.goalPct.toFixed(0)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">no goal</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Orphan links — only when they exist. Amber framing so it reads as
          "something to fix" rather than "campaign you forgot about". */}
      {data && data.orphans.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-100 flex items-center justify-between gap-3 bg-amber-50/50">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-semibold text-slate-900">Orphan links</h2>
              <span className="text-xs text-amber-700">
                · {data.meta.totalOrphans} link{data.meta.totalOrphans === 1 ? "" : "s"} not tied to any campaign
              </span>
            </div>
            <span className="text-xs text-slate-500">
              Showing top {data.orphans.length} by clicks
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-amber-100 text-xs text-amber-900/70 uppercase tracking-wider">
                  <th className="pl-4 py-2 pr-3 text-left font-medium">Link</th>
                  <th className="py-2 pr-3 text-right font-medium">Clicks</th>
                  <th className="py-2 pr-3 text-right font-medium">Conv.</th>
                  <th className="py-2 pr-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.orphans.map((o) => (
                  <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="pl-4 py-2 pr-3">
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-slate-900 truncate max-w-[260px] block">
                          {o.title || `/${o.code}`}
                        </span>
                        <code className="text-[11px] text-[#03A9F4]">/{o.code}</code>
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums font-medium text-slate-900">
                      {o.clicks.toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {o.conversions > 0 ? (
                        <span className="font-medium text-emerald-600">
                          {o.conversions.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <button
                        onClick={() => router.push(`/links/${o.id}`)}
                        className="text-xs text-[#03A9F4] hover:text-[#0288D1] font-medium"
                      >
                        Assign campaign →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4">
      <div className="flex items-center gap-1.5 mb-1.5 text-xs text-slate-400 uppercase tracking-wider">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-lg font-semibold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}
