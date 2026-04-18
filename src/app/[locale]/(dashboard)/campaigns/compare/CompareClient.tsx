"use client";

/**
 * /campaigns/compare?names=a,b,c — side-by-side deep comparison.
 *
 * Flow: user ticks 2-4 rows on /campaigns → "Side-by-side details" → lands
 * here. Top of page shows an overlay line chart and the winner callouts
 * ("best CVR", "most clicks", "closest to goal"). Below, one column per
 * campaign with its own KPIs + top sources + top mediums, so the user
 * can spot "why is A's CVR so much higher? — ah, it's mostly email
 * whereas B is mostly FB ads".
 *
 * Data sources:
 *   - /api/analytics/campaigns-summary — leaderboard numbers + daily
 *     time series, already Redis-cached
 *   - /api/analytics/raw — full click stream, so we can compute per-
 *     campaign source/medium breakdowns client-side via the same
 *     computeAnalytics helper the Campaign Detail Traffic tab uses.
 *     That payload is also cached, and we only hit it once regardless
 *     of how many campaigns are in the compare set.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "@/i18n/routing";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Target,
  MousePointerClick,
  Megaphone,
  Trophy,
  LineChart as LineChartIcon,
  X,
} from "lucide-react";
import { MultiCampaignChart } from "@/components/analytics/MultiCampaignChart";
import {
  computeAnalytics,
  type RawAnalyticsData,
} from "@/lib/analytics/compute";

interface CampaignRow {
  id: string | null;
  name: string;
  displayName: string | null;
  description: string | null;
  status: string | null;
  linkCount: number;
  clicks: number;
  conversions: number;
  cvr: number;
  goalClicks: number | null;
  goalPct: number | null;
}

interface SummaryResponse {
  campaigns: CampaignRow[];
  timeseries?: {
    dates: string[];
    perCampaign: Record<string, number[]>;
  };
  meta: { days: number };
}

const windowPresets: { value: string; days: number }[] = [
  { value: "7d", days: 7 },
  { value: "30d", days: 30 },
  { value: "90d", days: 90 },
];

function statusDot(status: string | null) {
  if (status === "ACTIVE") return "bg-emerald-500";
  if (status === "COMPLETED") return "bg-sky-400";
  if (status === "DRAFT") return "bg-slate-300";
  if (status === "ARCHIVED") return "bg-slate-400";
  return "bg-slate-300";
}

export default function CompareClient({ initialNames }: { initialNames: string[] }) {
  const router = useRouter();

  const [names, setNames] = useState<string[]>(initialNames);
  const [window, setWindow] = useState<string>("30d");
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [raw, setRaw] = useState<RawAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const preset = windowPresets.find((p) => p.value === window) ?? windowPresets[1];
    setLoading(true);
    try {
      const [summaryRes, rawRes] = await Promise.all([
        fetch(`/api/analytics/campaigns-summary?days=${preset.days}`),
        fetch(`/api/analytics/raw`),
      ]);
      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (rawRes.ok) setRaw(await rawRes.json());
    } catch (err) {
      console.error("compare fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [window]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const removeName = useCallback(
    (name: string) => {
      const next = names.filter((n) => n !== name);
      setNames(next);
      // Update URL so reloads preserve the trimmed set.
      const search = next.length > 0 ? `?names=${next.map(encodeURIComponent).join(",")}` : "";
      router.replace(`/campaigns/compare${search}`);
    },
    [names, router],
  );

  // Match the caller-supplied names against the summary. Gracefully
  // drop names that don't exist (e.g. stale URL after a delete).
  const selectedCampaigns = useMemo(() => {
    if (!summary) return [];
    const byName = new Map(summary.campaigns.map((c) => [c.name, c]));
    return names.map((n) => byName.get(n)).filter(Boolean) as CampaignRow[];
  }, [summary, names]);

  // Per-campaign top sources / mediums / top-link, computed client-side
  // from the raw analytics so we don't need a dedicated endpoint.
  const perCampaignBreakdown = useMemo(() => {
    if (!raw) return {};
    const end = new Date();
    const start = new Date();
    const days = windowPresets.find((p) => p.value === window)?.days ?? 30;
    start.setDate(end.getDate() - days);

    const out: Record<
      string,
      {
        sources: { name: string; clicks: number }[];
        mediums: { name: string; clicks: number }[];
        topLinks: { id: string; title: string | null; code: string; clicks: number }[];
      }
    > = {};
    for (const name of names) {
      const computed = computeAnalytics(raw, {
        rangeStart: start,
        rangeEnd: end,
        campaign: name,
      });
      out[name] = {
        sources: computed.utm.sources.slice(0, 3),
        mediums: computed.utm.mediums.slice(0, 3),
        topLinks: computed.topLinks.slice(0, 3).map((l) => ({
          id: l.id,
          title: l.title,
          code: l.code,
          clicks: l.clicks,
        })),
      };
    }
    return out;
  }, [raw, names, window]);

  // Time-series subset filtered to the selected names.
  const overlaySeries = useMemo(() => {
    if (!summary?.timeseries) return null;
    const out: Record<string, number[]> = {};
    for (const name of names) {
      const arr = summary.timeseries.perCampaign[name];
      if (arr) out[name] = arr;
    }
    return Object.keys(out).length >= 2 ? out : null;
  }, [summary, names]);

  // Winner callouts — who leads on each headline metric. Null when
  // nobody has numbers yet (e.g. brand-new campaigns, no traffic).
  const winners = useMemo(() => {
    if (selectedCampaigns.length === 0) return null;
    const best = <K extends keyof CampaignRow>(
      key: K,
      min = 0,
    ): CampaignRow | null => {
      let top: CampaignRow | null = null;
      for (const c of selectedCampaigns) {
        const v = (c[key] as number | null) ?? 0;
        if (v > min && (top === null || v > (top[key] as number))) top = c;
      }
      return top;
    };
    return {
      clicks: best("clicks"),
      conversions: best("conversions"),
      cvr: best("cvr"),
      goalPct: best("goalPct"),
    };
  }, [selectedCampaigns]);

  if (initialNames.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">Nothing selected</h1>
        <p className="text-sm text-slate-500">
          Head back to the Campaigns list, tick 2–4 campaigns, then click the
          &quot;Side-by-side details&quot; button.
        </p>
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#03A9F4] text-white text-sm font-medium rounded-lg hover:bg-[#0288D1] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Campaigns
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Campaigns
          </Link>
          <h1 className="text-xl font-semibold text-slate-900 mt-2">
            Compare {names.length} campaigns
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Side-by-side breakdown over the last {summary?.meta.days ?? 30} days.
          </p>
        </div>
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
      </div>

      {loading && !summary ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : selectedCampaigns.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-xl p-8 text-center">
          <p className="text-sm text-slate-500">
            None of the requested campaigns were found. They may have been deleted.
          </p>
        </div>
      ) : (
        <>
          {/* Winner callouts */}
          {winners && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <WinnerCard
                icon={<MousePointerClick className="w-4 h-4 text-slate-500" />}
                label="Most clicks"
                winner={winners.clicks}
                format={(c) => c.clicks.toLocaleString()}
              />
              <WinnerCard
                icon={<Target className="w-4 h-4 text-emerald-500" />}
                label="Most conversions"
                winner={winners.conversions}
                format={(c) => c.conversions.toLocaleString()}
              />
              <WinnerCard
                icon={<Trophy className="w-4 h-4 text-amber-500" />}
                label="Best CVR"
                winner={winners.cvr}
                format={(c) => `${c.cvr.toFixed(1)}%`}
              />
              <WinnerCard
                icon={<Megaphone className="w-4 h-4 text-violet-500" />}
                label="Closest to goal"
                winner={winners.goalPct}
                format={(c) =>
                  c.goalPct !== null ? `${c.goalPct.toFixed(0)}%` : "—"
                }
                emptyHint="No goals set"
              />
            </div>
          )}

          {/* Overlay chart */}
          {overlaySeries && summary?.timeseries && (
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <LineChartIcon className="w-4 h-4 text-[#03A9F4]" />
                <h2 className="text-sm font-semibold text-slate-900">
                  Daily clicks
                </h2>
                <span className="text-xs text-slate-400">
                  · last {summary.meta.days}d
                </span>
              </div>
              <MultiCampaignChart
                dates={summary.timeseries.dates}
                series={overlaySeries}
                height={280}
              />
            </div>
          )}

          {/* Side-by-side campaign columns */}
          <div
            className={`grid gap-4 ${
              selectedCampaigns.length === 2
                ? "md:grid-cols-2"
                : selectedCampaigns.length === 3
                  ? "md:grid-cols-3"
                  : "md:grid-cols-2 xl:grid-cols-4"
            }`}
          >
            {selectedCampaigns.map((c) => {
              const breakdown = perCampaignBreakdown[c.name];
              return (
                <div
                  key={c.name}
                  className="bg-white border border-slate-100 rounded-xl overflow-hidden flex flex-col"
                >
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">
                        {c.displayName || c.name}
                      </h3>
                      {c.displayName && (
                        <code className="text-[10px] text-slate-400">{c.name}</code>
                      )}
                      <div className="flex items-center gap-1.5 mt-1">
                        {c.status && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                            <span className={`w-1.5 h-1.5 rounded-full ${statusDot(c.status)}`} />
                            {c.status}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">· {c.linkCount} links</span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeName(c.name)}
                      className="p-1 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors shrink-0"
                      title="Remove from comparison"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* KPIs */}
                  <div className="px-4 py-3 grid grid-cols-3 gap-2 border-b border-slate-100">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">
                        Clicks
                      </p>
                      <p className="text-base font-semibold text-slate-900 tabular-nums">
                        {c.clicks.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">
                        Conv.
                      </p>
                      <p className="text-base font-semibold text-emerald-600 tabular-nums">
                        {c.conversions.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">
                        CVR
                      </p>
                      <p className="text-base font-semibold text-slate-900 tabular-nums">
                        {c.conversions > 0 ? `${c.cvr.toFixed(1)}%` : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Goal bar */}
                  {c.goalPct !== null && c.goalClicks ? (
                    <div className="px-4 py-3 border-b border-slate-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400">
                          Goal
                        </span>
                        <span className="text-xs tabular-nums text-slate-600">
                          {c.clicks.toLocaleString()} / {c.goalClicks.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            c.goalPct >= 100 ? "bg-emerald-500" : "bg-violet-500"
                          }`}
                          style={{ width: `${c.goalPct}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 py-3 border-b border-slate-100 text-center">
                      <Link
                        href={`/campaigns/${encodeURIComponent(c.name)}`}
                        className="text-xs text-slate-400 hover:text-[#03A9F4]"
                      >
                        No goal set — add one →
                      </Link>
                    </div>
                  )}

                  {/* Breakdown sections */}
                  <div className="px-4 py-3 space-y-3 flex-1">
                    <BreakdownList
                      title="Top sources"
                      rows={breakdown?.sources ?? []}
                      total={c.clicks}
                      badgeClass="bg-cyan-50 text-cyan-700 border-cyan-100"
                    />
                    <BreakdownList
                      title="Top mediums"
                      rows={breakdown?.mediums ?? []}
                      total={c.clicks}
                      badgeClass="bg-violet-50 text-violet-700 border-violet-100"
                    />
                    {breakdown && breakdown.topLinks.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">
                          Top links
                        </p>
                        <ul className="space-y-1">
                          {breakdown.topLinks.map((l) => (
                            <li
                              key={l.id}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="truncate text-slate-700 flex-1 min-w-0">
                                {l.title || `/${l.code}`}
                              </span>
                              <span className="tabular-nums font-medium text-slate-900">
                                {l.clicks.toLocaleString()}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Deep-link CTA */}
                  <Link
                    href={`/campaigns/${encodeURIComponent(c.name)}`}
                    className="block px-4 py-2.5 text-xs font-medium text-[#03A9F4] border-t border-slate-100 hover:bg-sky-50/40 transition-colors text-center"
                  >
                    Open full detail →
                  </Link>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function WinnerCard({
  icon,
  label,
  winner,
  format,
  emptyHint,
}: {
  icon: React.ReactNode;
  label: string;
  winner: CampaignRow | null;
  format: (c: CampaignRow) => string;
  emptyHint?: string;
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-xl p-4">
      <div className="flex items-center gap-1.5 text-xs text-slate-400 uppercase tracking-wider mb-1.5">
        {icon}
        <span>{label}</span>
      </div>
      {winner ? (
        <>
          <p className="text-sm font-semibold text-slate-900 truncate">
            {winner.displayName || winner.name}
          </p>
          <p className="text-lg font-semibold text-[#03A9F4] tabular-nums">
            {format(winner)}
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-400 italic">{emptyHint ?? "No data"}</p>
      )}
    </div>
  );
}

function BreakdownList({
  title,
  rows,
  total,
  badgeClass,
}: {
  title: string;
  rows: { name: string; clicks: number }[];
  total: number;
  badgeClass: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-300 italic">No data</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => {
            const pct = total > 0 ? (row.clicks / total) * 100 : 0;
            return (
              <li key={row.name} className="flex items-center gap-2 text-xs">
                <span
                  className={`px-1.5 py-0.5 rounded border text-[10px] font-medium truncate max-w-[100px] ${badgeClass}`}
                  title={row.name}
                >
                  {row.name || "—"}
                </span>
                <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden min-w-0">
                  <div
                    className="h-full bg-slate-400 rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="tabular-nums text-slate-700 w-10 text-right">
                  {row.clicks.toLocaleString()}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
