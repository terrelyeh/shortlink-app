"use client";

/**
 * /campaigns/compare?names=a,b,c — side-by-side deep comparison.
 */

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
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
import { SyncButton } from "@/components/layout/SyncButton";
import { computeAnalytics, type RawAnalyticsData } from "@/lib/analytics/compute";
import { periodBoundsMs, type CampaignPhase } from "@/lib/campaign-period";

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
  startDate: string | null;
  endDate: string | null;
  phase: CampaignPhase;
  periodClicks: number;
}

interface SummaryResponse {
  campaigns: CampaignRow[];
  timeseries?: {
    dates: string[];
    perCampaign: Record<string, number[]>;
  };
  meta: { days: number };
}

// Same presets as the campaign list; "period" = each campaign's own dates.
const windowPresets: { value: string; days: number }[] = [
  { value: "period", days: 730 },
  { value: "all", days: 730 },
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

const PHASE_BADGE: Record<CampaignPhase, string> = {
  running: "active",
  upcoming: "draft",
  ended: "completed",
  archived: "archived",
};

export default function CompareClient({ initialNames }: { initialNames: string[] }) {
  const router = useRouter();
  const t = useTranslations("compare");
  const tCampaigns = useTranslations("campaigns");

  const [names, setNames] = useState<string[]>(initialNames);
  const [window, setWindow] = useState<string>("period");
  // Fixed at mount so the breakdown memo stays pure.
  const [now] = useState(() => Date.now());
  const isPeriod = window === "period";
  const shown = useCallback(
    (c: CampaignRow) => (isPeriod ? (c.periodClicks ?? c.clicks) : c.clicks),
    [isPeriod],
  );
  const phaseLabel = (p: CampaignPhase) =>
    p === "running"
      ? tCampaigns("statusActive")
      : p === "upcoming"
        ? tCampaigns("statusUpcoming")
        : p === "ended"
          ? tCampaigns("statusCompleted")
          : tCampaigns("statusArchived");

  // Share keys with other pages: campaigns-summary + analytics-raw so the
  // leaderboard and /analytics hit the same cache entries.
  const summaryKey = useMemo(() => ["campaigns-summary", window] as const, [window]);
  const rawKey = useMemo(() => ["analytics-raw"] as const, []);

  const { data: summary, isLoading: summaryLoading } = useQuery<SummaryResponse>({
    queryKey: summaryKey,
    queryFn: async () => {
      const preset = windowPresets.find((p) => p.value === window) ?? windowPresets[0];
      const res = await fetch(`/api/analytics/campaigns-summary?days=${preset.days}`);
      if (!res.ok) throw new Error("Failed to load campaigns summary");
      return (await res.json()) as SummaryResponse;
    },
  });
  const { data: raw } = useQuery<RawAnalyticsData>({
    queryKey: rawKey,
    queryFn: async () => {
      const res = await fetch("/api/analytics/raw");
      if (!res.ok) throw new Error("Failed to load raw analytics");
      return (await res.json()) as RawAnalyticsData;
    },
  });
  const loading = summaryLoading;

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
    const days = windowPresets.find((p) => p.value === window)?.days ?? 30;
    const windowStart = new Date(now - days * 86_400_000);
    const sinceMs = new Date(raw.meta.since).getTime();
    const byName = new Map((summary?.campaigns ?? []).map((c) => [c.name, c]));

    const out: Record<
      string,
      {
        sources: { name: string; clicks: number }[];
        mediums: { name: string; clicks: number }[];
        topLinks: { id: string; title: string | null; code: string; clicks: number }[];
      }
    > = {};
    for (const name of names) {
      // In "period" mode each column uses its own campaign's dates.
      const b = isPeriod ? periodBoundsMs(byName.get(name)) : null;
      const computed = computeAnalytics(raw, {
        rangeStart: b ? new Date(Math.max(b.fromMs, sinceMs)) : windowStart,
        rangeEnd: b ? new Date(Math.min(b.toMs, now)) : new Date(now),
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
  }, [raw, names, window, isPeriod, summary, now]);

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
    const best = (get: (c: CampaignRow) => number | null): CampaignRow | null => {
      let top: CampaignRow | null = null;
      let topV = 0;
      for (const c of selectedCampaigns) {
        const v = get(c) ?? 0;
        if (v > 0 && (top === null || v > topV)) {
          top = c;
          topV = v;
        }
      }
      return top;
    };
    return {
      clicks: best(shown),
      goalPct: best((c) => c.goalPct),
    };
  }, [selectedCampaigns, shown]);

  if (initialNames.length === 0) {
    return (
      <div style={{ maxWidth: 520, margin: "48px auto", textAlign: "center" }}>
        <h1 className="page-title" style={{ marginBottom: 8 }}>
          {t("nothingSelected")}
        </h1>
        <p className="page-sub" style={{ marginBottom: 20 }}>
          {t("nothingSelectedHint")}
        </p>
        <Link href="/campaigns" className="btn btn-primary">
          <ArrowLeft size={13} /> {t("backToCampaigns")}
        </Link>
      </div>
    );
  }

  const days = summary?.meta.days ?? 30;
  const windowLabel = isPeriod
    ? t("windowPeriod")
    : window === "all"
      ? t("windowAll")
      : t("lastNd", { days });

  return (
    <>
      <PageHeader
        back={t("backToCampaigns")}
        onBack={() => router.push("/campaigns")}
        title={t("title", { n: names.length })}
        description={t("subtitleWindow", { window: windowLabel })}
        actions={
          <>
            <SyncButton queryKeys={[[...summaryKey], [...rawKey]]} />
            <div className="segmented">
              {windowPresets.map((p) => (
                <button
                  key={p.value}
                  className={window === p.value ? "active" : ""}
                  onClick={() => setWindow(p.value)}
                >
                  {p.value === "period" ? t("presetPeriod") : p.value === "all" ? t("windowAll") : p.value}
                </button>
              ))}
            </div>
          </>
        }
      />

      {loading && !summary ? (
        <div style={{ padding: 64, textAlign: "center" }}>
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--ink-500)" }} />
        </div>
      ) : selectedCampaigns.length === 0 ? (
        <div className="card card-padded" style={{ textAlign: "center", padding: 32 }}>
          <p className="muted" style={{ fontSize: 13 }}>
            {t("notFound")}
          </p>
        </div>
      ) : (
        <>
          {/* Winner KPIs */}
          {winners && (
            <div className="kpi-row" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
              <WinnerCard
                icon={<MousePointerClick size={12} />}
                label={t("mostClicks")}
                winner={winners.clicks}
                format={(c) => shown(c).toLocaleString()}
                emptyHint={t("noData")}
              />
              <WinnerCard
                icon={<Flag size={12} />}
                label={t("closestToGoal")}
                winner={winners.goalPct}
                format={(c) => (c.goalPct !== null ? `${c.goalPct.toFixed(0)}%` : "—")}
                emptyHint={t("noGoalsSet")}
              />
            </div>
          )}

          {/* Overlay chart */}
          {overlaySeries && summary?.timeseries && (
            <div className="card card-padded" style={{ marginBottom: 14 }}>
              <div className="row-between" style={{ marginBottom: 10 }}>
                <div className="section-title">
                  <LineChartIcon size={14} style={{ color: "var(--ink-400)" }} />
                  {t("dailyClicks")}
                  <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
                    · {isPeriod || window === "all" ? t("windowAll") : t("lastNd", { days })}
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
                        {c.id && (
                          <span className={`badge ${PHASE_BADGE[c.phase ?? "running"]}`}>
                            <span className="badge-dot" />
                            {phaseLabel(c.phase ?? "running")}
                          </span>
                        )}
                        <span>·</span>
                        <span>{t("linksCount", { n: c.linkCount })}</span>
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: 4 }}
                      onClick={() => removeName(c.name)}
                      title={t("removeFromComparison")}
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="compare-metrics" style={{ gridTemplateColumns: "1fr" }}>
                    <div>
                      <div className="compare-metric-label">
                        {t("clicksIn", { window: windowLabel })}
                      </div>
                      <div className="compare-metric-val">{shown(c).toLocaleString()}</div>
                    </div>
                  </div>

                  {c.goalPct !== null && c.goalClicks ? (
                    <div className="compare-row">
                      <div className="row-between" style={{ marginBottom: 6 }}>
                        <span className="compare-row-label" style={{ margin: 0 }}>
                          {t("goalProgress")}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: "var(--font-mono)",
                            color: "var(--ink-500)",
                          }}
                        >
                          {(c.periodClicks ?? c.clicks).toLocaleString()} / {c.goalClicks.toLocaleString()}
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
                      {t("noGoalSet")}{" "}
                      <Link
                        href={`/campaigns/${encodeURIComponent(c.name)}`}
                        style={{ color: "var(--brand-600)" }}
                      >
                        {t("addOne")}
                      </Link>
                    </div>
                  )}

                  <div className="compare-row">
                    <div className="compare-row-label">{t("topSources")}</div>
                    {breakdown && breakdown.sources.length > 0 ? (
                      <BreakdownList rows={breakdown.sources} total={shown(c)} pillClass="pill-source" />
                    ) : (
                      <div className="placeholder">{t("noData")}</div>
                    )}
                  </div>

                  <div className="compare-row">
                    <div className="compare-row-label">{t("topMediums")}</div>
                    {breakdown && breakdown.mediums.length > 0 ? (
                      <BreakdownList rows={breakdown.mediums} total={shown(c)} pillClass="pill-medium" />
                    ) : (
                      <div className="placeholder">{t("noData")}</div>
                    )}
                  </div>

                  <div className="compare-row">
                    <div className="compare-row-label">{t("topLinks")}</div>
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
                      <div className="placeholder">{t("noData")}</div>
                    )}
                  </div>

                  <Link
                    href={`/campaigns/${encodeURIComponent(c.name)}`}
                    className="compare-col-foot"
                  >
                    {t("openFullDetail")}
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
              {emptyHint ?? "—"}
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
