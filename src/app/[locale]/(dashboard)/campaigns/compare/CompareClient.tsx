"use client";

/**
 * /campaigns/compare?names=a,b,c — side-by-side deep comparison.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "@/i18n/routing";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  MousePointerClick,
  LineChart as LineChartIcon,
  X,
  Flag,
} from "lucide-react";
import { MultiCampaignChart } from "@/components/analytics/MultiCampaignChart";
import { PageHeader } from "@/components/layout/PageHeader";
import { computeAnalytics, type RawAnalyticsData } from "@/lib/analytics/compute";

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

const COLUMN_COLORS = [
  "var(--brand-500)",
  "var(--data-violet)",
  "var(--data-emerald)",
  "var(--data-amber)",
];

function statusClass(status: string | null): string {
  if (status === "ACTIVE") return "active";
  if (status === "COMPLETED") return "completed";
  if (status === "DRAFT") return "draft";
  if (status === "ARCHIVED") return "archived";
  return "draft";
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
      const search = next.length > 0 ? `?names=${next.map(encodeURIComponent).join(",")}` : "";
      router.replace(`/campaigns/compare${search}`);
    },
    [names, router],
  );

  const selectedCampaigns = useMemo(() => {
    if (!summary) return [];
    const byName = new Map(summary.campaigns.map((c) => [c.name, c]));
    return names.map((n) => byName.get(n)).filter(Boolean) as CampaignRow[];
  }, [summary, names]);

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

  const overlaySeries = useMemo(() => {
    if (!summary?.timeseries) return null;
    const out: Record<string, number[]> = {};
    for (const name of names) {
      const arr = summary.timeseries.perCampaign[name];
      if (arr) out[name] = arr;
    }
    return Object.keys(out).length >= 2 ? out : null;
  }, [summary, names]);

  const winners = useMemo(() => {
    if (selectedCampaigns.length === 0) return null;
    const best = <K extends keyof CampaignRow>(key: K, min = 0): CampaignRow | null => {
      let top: CampaignRow | null = null;
      for (const c of selectedCampaigns) {
        const v = (c[key] as number | null) ?? 0;
        if (v > min && (top === null || v > (top[key] as number))) top = c;
      }
      return top;
    };
    return {
      clicks: best("clicks"),
      goalPct: best("goalPct"),
    };
  }, [selectedCampaigns]);

  if (initialNames.length === 0) {
    return (
      <div style={{ maxWidth: 520, margin: "48px auto", textAlign: "center" }}>
        <h1 className="page-title" style={{ marginBottom: 8 }}>
          Nothing selected
        </h1>
        <p className="page-sub" style={{ marginBottom: 20 }}>
          Head back to the Campaigns list, tick 2–4 campaigns, then click the
          &quot;Side-by-side details&quot; button.
        </p>
        <Link href="/campaigns" className="btn btn-primary">
          <ArrowLeft size={13} /> Back to Campaigns
        </Link>
      </div>
    );
  }

  const days = summary?.meta.days ?? 30;

  return (
    <>
      <PageHeader
        back="Back to Campaigns"
        onBack={() => router.push("/campaigns")}
        title={`Compare ${names.length} campaigns`}
        description={`Side-by-side breakdown over the last ${days} days.`}
        actions={
          <div className="segmented">
            {windowPresets.map((p) => (
              <button
                key={p.value}
                className={window === p.value ? "active" : ""}
                onClick={() => setWindow(p.value)}
              >
                {p.value}
              </button>
            ))}
          </div>
        }
      />

      {loading && !summary ? (
        <div style={{ padding: 64, textAlign: "center" }}>
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--ink-500)" }} />
        </div>
      ) : selectedCampaigns.length === 0 ? (
        <div className="card card-padded" style={{ textAlign: "center", padding: 32 }}>
          <p className="muted" style={{ fontSize: 13 }}>
            None of the requested campaigns were found. They may have been deleted.
          </p>
        </div>
      ) : (
        <>
          {/* Winner KPIs */}
          {winners && (
            <div className="kpi-row" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
              <WinnerCard
                icon={<MousePointerClick size={12} />}
                label="Most clicks"
                winner={winners.clicks}
                format={(c) => c.clicks.toLocaleString()}
              />
              <WinnerCard
                icon={<Flag size={12} />}
                label="Closest to goal"
                winner={winners.goalPct}
                format={(c) => (c.goalPct !== null ? `${c.goalPct.toFixed(0)}%` : "—")}
                emptyHint="No goals set"
              />
            </div>
          )}

          {/* Overlay chart */}
          {overlaySeries && summary?.timeseries && (
            <div className="card card-padded" style={{ marginBottom: 14 }}>
              <div className="row-between" style={{ marginBottom: 10 }}>
                <div className="section-title">
                  <LineChartIcon size={14} style={{ color: "var(--ink-400)" }} />
                  Daily clicks
                  <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
                    · last {days}d
                  </span>
                </div>
                <div className="row" style={{ gap: 12, fontSize: 11.5 }}>
                  {selectedCampaigns.map((c, i) => (
                    <div key={c.name} className="row" style={{ gap: 6 }}>
                      <span
                        style={{
                          width: 10,
                          height: 2,
                          background: COLUMN_COLORS[i % COLUMN_COLORS.length],
                          borderRadius: 1,
                          display: "inline-block",
                        }}
                      />
                      <span style={{ fontFamily: "var(--font-mono)" }}>{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <MultiCampaignChart
                dates={summary.timeseries.dates}
                series={overlaySeries}
                height={280}
              />
            </div>
          )}

          {/* Columns */}
          <div
            className="compare-grid"
            style={{
              gridTemplateColumns: `repeat(${Math.min(selectedCampaigns.length, 4)}, minmax(0, 1fr))`,
            }}
          >
            {selectedCampaigns.map((c, idx) => {
              const breakdown = perCampaignBreakdown[c.name];
              const accent = COLUMN_COLORS[idx % COLUMN_COLORS.length];
              return (
                <div key={c.name} className="compare-col">
                  <div
                    className="compare-col-head"
                    style={{ borderTop: `2px solid ${accent}` }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        className="compare-col-name"
                        style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {c.displayName || c.name}
                      </div>
                      <div className="compare-col-meta">
                        {c.status && (
                          <span className={`badge ${statusClass(c.status)}`}>
                            <span className="badge-dot" />
                            {c.status}
                          </span>
                        )}
                        <span>·</span>
                        <span>
                          {c.linkCount} link{c.linkCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: 4 }}
                      onClick={() => removeName(c.name)}
                      title="Remove from comparison"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="compare-metrics" style={{ gridTemplateColumns: "1fr" }}>
                    <div>
                      <div className="compare-metric-label">Clicks · last {days}d</div>
                      <div className="compare-metric-val">{c.clicks.toLocaleString()}</div>
                    </div>
                  </div>

                  {c.goalPct !== null && c.goalClicks ? (
                    <div className="compare-row">
                      <div className="row-between" style={{ marginBottom: 6 }}>
                        <span className="compare-row-label" style={{ margin: 0 }}>
                          Goal progress
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: "var(--font-mono)",
                            color: "var(--ink-500)",
                          }}
                        >
                          {c.clicks.toLocaleString()} / {c.goalClicks.toLocaleString()}
                        </span>
                      </div>
                      <div className="goal-progress" style={{ margin: 0 }}>
                        <div
                          style={{
                            width: `${Math.min(c.goalPct, 100)}%`,
                            background:
                              c.goalPct >= 100
                                ? "var(--data-emerald)"
                                : "linear-gradient(90deg, var(--brand-500), var(--data-violet))",
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div
                      className="compare-row"
                      style={{ textAlign: "center", fontSize: 11.5, color: "var(--ink-500)" }}
                    >
                      No goal set —{" "}
                      <Link
                        href={`/campaigns/${encodeURIComponent(c.name)}`}
                        style={{ color: "var(--brand-600)" }}
                      >
                        add one →
                      </Link>
                    </div>
                  )}

                  <div className="compare-row">
                    <div className="compare-row-label">Top sources</div>
                    {breakdown && breakdown.sources.length > 0 ? (
                      <BreakdownList rows={breakdown.sources} total={c.clicks} pillClass="pill-source" />
                    ) : (
                      <div className="placeholder">No data</div>
                    )}
                  </div>

                  <div className="compare-row">
                    <div className="compare-row-label">Top mediums</div>
                    {breakdown && breakdown.mediums.length > 0 ? (
                      <BreakdownList rows={breakdown.mediums} total={c.clicks} pillClass="pill-medium" />
                    ) : (
                      <div className="placeholder">No data</div>
                    )}
                  </div>

                  <div className="compare-row">
                    <div className="compare-row-label">Top links</div>
                    {breakdown && breakdown.topLinks.length > 0 ? (
                      <div className="stack" style={{ gap: 4 }}>
                        {breakdown.topLinks.map((l) => (
                          <div key={l.id} className="row-between" style={{ fontSize: 12 }}>
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: 12,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              {l.title || `/${l.code}`}
                            </span>
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: 12,
                                color: "var(--ink-200)",
                              }}
                            >
                              {l.clicks.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="placeholder">No data</div>
                    )}
                  </div>

                  <Link
                    href={`/campaigns/${encodeURIComponent(c.name)}`}
                    className="compare-col-foot"
                  >
                    Open full detail →
                  </Link>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
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
    <div className="kpi">
      <div className="kpi-label">
        {icon}
        {label}
      </div>
      {winner ? (
        <>
          <div
            className="kpi-value mono"
            style={{ color: "var(--brand-600)", fontSize: 22 }}
          >
            {format(winner)}
          </div>
          <div className="kpi-sub" style={{ fontFamily: "var(--font-mono)" }}>
            {winner.displayName || winner.name}
          </div>
        </>
      ) : (
        <>
          <div className="kpi-value">
            <span className="placeholder" style={{ fontSize: 18 }}>
              No data
            </span>
          </div>
          <div className="kpi-sub muted">{emptyHint ?? ""}</div>
        </>
      )}
    </div>
  );
}

function BreakdownList({
  rows,
  total,
  pillClass,
}: {
  rows: { name: string; clicks: number }[];
  total: number;
  pillClass: string;
}) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      {rows.map((row) => {
        const pct = total > 0 ? (row.clicks / total) * 100 : 0;
        return (
          <div key={row.name} className="row" style={{ gap: 8 }}>
            <span className={`pill ${pillClass}`} title={row.name} style={{ maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {row.name || "—"}
            </span>
            <div className="bar-track" style={{ flex: 1, minWidth: 40 }}>
              <div className="bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--ink-200)",
                minWidth: 30,
                textAlign: "right",
              }}
            >
              {row.clicks.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
