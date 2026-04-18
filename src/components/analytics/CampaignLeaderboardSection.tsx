"use client";

/**
 * Cross-campaign comparison for the Analytics page. Renders two blocks:
 *
 *   1. Campaign leaderboard — one row per campaign with clicks /
 *      conversions / CVR / goal progress, sorted by clicks. Click-through
 *      to the Campaign Detail page for the deep dive.
 *
 *   2. Orphan links — short links with no campaign attached. Surfaces
 *      tracking gaps ("who's generating traffic without being tagged to
 *      a campaign?") without forcing the user to manually scan /links.
 *
 * This is the main "I'm looking at the whole account, not one campaign"
 * view. Lives on /analytics because that's the page marketers open when
 * they want a bird's-eye view across all active work.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Megaphone, Link2 } from "lucide-react";

interface CampaignSummary {
  name: string;
  displayName: string | null;
  status: string | null;
  linkCount: number;
  clicks: number;
  conversions: number;
  cvr: number;
  goalClicks: number | null;
  goalPct: number | null;
}

interface OrphanLink {
  id: string;
  code: string;
  title: string | null;
  originalUrl: string;
  clicks: number;
  conversions: number;
}

interface SummaryResponse {
  campaigns: CampaignSummary[];
  orphans: OrphanLink[];
  meta: {
    days: number;
    totalCampaigns: number;
    totalOrphans: number;
    since: string;
  };
}

const statusDot: Record<string, string> = {
  ACTIVE: "bg-emerald-500",
  DRAFT: "bg-slate-300",
  COMPLETED: "bg-sky-400",
  PAUSED: "bg-amber-500",
  ARCHIVED: "bg-slate-400",
};

type SortKey = "clicks" | "conversions" | "cvr" | "goalPct";

export function CampaignLeaderboardSection({ days = 30 }: { days?: number }) {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("clicks");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/analytics/campaigns-summary?days=${days}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setData(d);
      })
      .catch((err) => console.error("leaderboard fetch failed:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const sortedCampaigns = data
    ? [...data.campaigns].sort((a, b) => {
        if (sortKey === "cvr") return b.cvr - a.cvr;
        if (sortKey === "conversions") return b.conversions - a.conversions;
        if (sortKey === "goalPct") return (b.goalPct ?? -1) - (a.goalPct ?? -1);
        return b.clicks - a.clicks;
      })
    : [];

  return (
    <div className="space-y-4">
      {/* Leaderboard */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-semibold text-slate-900">Campaign leaderboard</h2>
            <span className="text-xs text-slate-400">· last {days}d</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-400 mr-1">Sort by</span>
            {(["clicks", "conversions", "cvr", "goalPct"] as SortKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setSortKey(k)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  sortKey === k
                    ? "bg-slate-100 text-slate-900 font-medium"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {k === "goalPct" ? "Goal %" : k === "cvr" ? "CVR" : k.charAt(0).toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : sortedCampaigns.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            No campaigns with traffic in the last {days} days.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wider">
                  <th className="pl-4 py-2 pr-3 text-left font-medium">Campaign</th>
                  <th className="py-2 pr-3 text-left font-medium">Status</th>
                  <th className="py-2 pr-3 text-right font-medium">Links</th>
                  <th className="py-2 pr-3 text-right font-medium">Clicks</th>
                  <th className="py-2 pr-3 text-right font-medium">Conv.</th>
                  <th className="py-2 pr-3 text-right font-medium">CVR</th>
                  <th className="py-2 pr-4 text-right font-medium">Goal</th>
                </tr>
              </thead>
              <tbody>
                {sortedCampaigns.map((c) => (
                  <tr
                    key={c.name}
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="pl-4 py-2.5 pr-3">
                      <Link
                        href={`/campaigns/${encodeURIComponent(c.name)}`}
                        className="group inline-flex flex-col min-w-0"
                      >
                        <span className="text-sm font-medium text-slate-900 group-hover:text-[#03A9F4] truncate max-w-[240px]">
                          {c.displayName || c.name}
                        </span>
                        {c.displayName && (
                          <span className="text-[10px] font-mono text-slate-400 truncate max-w-[240px]">
                            {c.name}
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3">
                      {c.status ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDot[c.status] ?? "bg-slate-300"}`} />
                          {c.status}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300 italic">utm-only</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700">
                      {c.linkCount}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums font-medium text-slate-900">
                      {c.clicks.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {c.conversions > 0 ? (
                        <span className="font-medium text-emerald-600">{c.conversions.toLocaleString()}</span>
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
                              c.goalPct >= 100 ? "text-emerald-600 font-medium" : "text-slate-500"
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

      {/* Orphan links — only render the section when there are any, so the
          Analytics page doesn't show an empty box to well-governed workspaces. */}
      {data && data.orphans.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-100 flex items-center justify-between gap-3 bg-amber-50/50">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-semibold text-slate-900">Orphan links</h2>
              <span className="text-xs text-amber-700">
                · {data.meta.totalOrphans} link{data.meta.totalOrphans === 1 ? "" : "s"} with no campaign
              </span>
            </div>
            <span className="text-xs text-slate-500">Showing top {data.orphans.length} by clicks</span>
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
                  <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
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
                        <span className="font-medium text-emerald-600">{o.conversions.toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          href={`/links/${o.id}`}
                          className="text-xs text-[#03A9F4] hover:text-[#0288D1] font-medium"
                        >
                          Assign →
                        </Link>
                      </div>
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

