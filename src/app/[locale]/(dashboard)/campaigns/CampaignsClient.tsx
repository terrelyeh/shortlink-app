"use client";

/**
 * Campaigns list — the "how's every campaign doing?" hub.
 *
 * Leaderboard lives here — every campaign row shows windowed clicks,
 * conversions, CVR and goal progress. Select 2–4 rows to overlay a
 * daily-clicks chart and jump into /campaigns/compare for side-by-side.
 */

import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { useQuery } from "@tanstack/react-query";
import {
  Megaphone,
  Search,
  Link2,
  Plus,
  Trophy,
  LineChart as LineChartIcon,
  ArrowRight,
  Loader2,
  MousePointerClick,
  Flag,
  SlidersHorizontal,
  X,
  Rocket,
  Download,
  ChevronDown,
  CalendarRange,
  Table2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MultiCampaignChart } from "@/components/analytics/MultiCampaignChart";
import { TrendCell, type TrendState } from "@/components/analytics/TrendCell";
import { SyncButton } from "@/components/layout/SyncButton";
import { formatRelativeTime } from "@/lib/utils/format";
import { storedDateToDay, type CampaignPhase } from "@/lib/campaign-period";
import { goalPaceFraction } from "@/lib/campaign-goal";

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
  startDate: string | null;
  endDate: string | null;
  phase: CampaignPhase;
  periodClicks: number;
  lastClickAt: string | null;
  sparkline: number[];
  trendState: TrendState;
  trendPct: number | null;
}

interface OrphanRow {
  id: string;
  code: string;
  title: string | null;
  originalUrl: string;
  clicks: number;
  conversions: number;
  lastClickAt: string | null;
}

interface SummaryResponse {
  campaigns: CampaignRow[];
  orphans: OrphanRow[];
  timeseries?: {
    dates: string[];
    perCampaign: Record<string, number[]>;
  };
  meta: {
    days: number;
    totalCampaigns: number;
    totalOrphans: number;
    since: string;
  };
}

const MAX_SELECTION = 4;

type SortKey = "clicks" | "goalPct" | "name";

// "period" = each campaign's own start–end dates (all time when unset).
// It fetches the 730-day payload and reads `periodClicks` per row.
const windowPresets: { value: string; labelKey: string; days: number }[] = [
  { value: "period", labelKey: "periodPreset", days: 730 },
  { value: "7d", labelKey: "last7Days", days: 7 },
  { value: "30d", labelKey: "last30Days", days: 30 },
  { value: "90d", labelKey: "last90Days", days: 90 },
  { value: "all", labelKey: "allTime", days: 730 },
];

const PHASE_BADGE: Record<CampaignPhase, string> = {
  running: "active",
  upcoming: "draft",
  ended: "completed",
  archived: "archived",
};

/** "11/19 – 2/26" style short period for the list row; null when unset. */
function shortPeriod(c: { startDate: string | null; endDate: string | null }, openEnd: string): string | null {
  const s = storedDateToDay(c.startDate);
  const e = storedDateToDay(c.endDate);
  if (!s && !e) return null;
  const fmt = (d: string) => `${d.slice(0, 4)}/${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  return `${s ? fmt(s) : "…"} – ${e ? fmt(e) : openEnd}`;
}

export default function CampaignsClient() {
  const t = useTranslations("campaigns");
  const tCommon = useTranslations("common");
  const router = useRouter();

  // Default = each campaign's own period, so the numbers match the
  // campaign page (it defaults to the same window).
  const [window, setWindow] = useState<string>("period");
  const [nowMs] = useState(() => Date.now());
  const isPeriod = window === "period";
  const shownClicks = useCallback(
    (c: CampaignRow) => (isPeriod ? (c.periodClicks ?? c.clicks) : c.clicks),
    [isPeriod],
  );
  const phaseLabel = (p: CampaignPhase) =>
    p === "running"
      ? t("statusActive")
      : p === "upcoming"
        ? t("statusUpcoming")
        : p === "ended"
          ? t("statusCompleted")
          : t("statusArchived");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("clicks");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Export honors the currently-selected time window so the CSV matches
  // what's on screen.
  const exportDays =
    (windowPresets.find((p) => p.value === window) ?? windowPresets[0]).days;

  const toggleSelected = useCallback((name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else if (next.size < MAX_SELECTION) next.add(name);
      return next;
    });
  }, []);

  const queryKey = useMemo(() => ["campaigns-summary", window] as const, [window]);

  const { data, isLoading: loading } = useQuery<SummaryResponse>({
    queryKey,
    queryFn: async () => {
      const preset = windowPresets.find((p) => p.value === window) ?? windowPresets[0];
      const res = await fetch(`/api/analytics/campaigns-summary?days=${preset.days}`);
      if (!res.ok) throw new Error("Failed to fetch campaigns summary");
      return (await res.json()) as SummaryResponse;
    },
  });

  const campaigns = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    const filtered = data.campaigns.filter((c) => {
      const phase = c.phase ?? "running";
      if (statusFilter) {
        if (phase !== statusFilter) return false;
      } else {
        if (phase === "archived") return false;
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
      if (sortKey === "goalPct") return (b.goalPct ?? -1) - (a.goalPct ?? -1);
      return shownClicks(b) - shownClicks(a);
    });
  }, [data, searchQuery, statusFilter, sortKey, shownClicks]);

  const totals = useMemo(() => {
    if (!data) return { clicks: 0, withGoal: 0, visible: 0, active: 0, upcoming: 0, ended: 0, archived: 0 };
    const visible = data.campaigns.filter((c) => c.phase !== "archived");
    return {
      clicks: visible.reduce((s, c) => s + shownClicks(c), 0),
      withGoal: visible.filter((c) => c.goalClicks).length,
      visible: visible.length,
      active: data.campaigns.filter((c) => (c.phase ?? "running") === "running").length,
      upcoming: data.campaigns.filter((c) => c.phase === "upcoming").length,
      ended: data.campaigns.filter((c) => c.phase === "ended").length,
      archived: data.campaigns.filter((c) => c.phase === "archived").length,
    };
  }, [data, shownClicks]);

  const overlaySeries = useMemo(() => {
    if (!data?.timeseries || selected.size < 2) return null;
    const out: Record<string, number[]> = {};
    for (const name of selected) {
      const arr = data.timeseries.perCampaign[name];
      if (arr) out[name] = arr;
    }
    return out;
  }, [data, selected]);

  const maxClicks = Math.max(1, ...campaigns.map((c) => shownClicks(c)));
  const windowLabel = isPeriod
    ? t("periodPresetLong")
    : window === "all"
      ? t("allTime")
      : t("lastNd", { days: data?.meta.days ?? 30 });

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            <SyncButton queryKeys={[[...queryKey]]} />
            {selected.size >= 2 && (
              <button
                className="btn btn-secondary"
                onClick={() =>
                  router.push(
                    `/campaigns/compare?names=${Array.from(selected)
                      .map((n) => encodeURIComponent(n))
                      .join(",")}`,
                  )
                }
              >
                <SlidersHorizontal size={13} /> {t("compareN", { n: selected.size })}
              </button>
            )}
            {/* Export CSV — dropdown with two formats. Both honor the
                current time-window selection. Click-outside closes via
                the fixed overlay (same pattern as link row menus). */}
            <div style={{ position: "relative" }}>
              <button
                className="btn btn-secondary"
                onClick={() => setExportMenuOpen((v) => !v)}
              >
                <Download size={13} /> {tCommon("export")}
                <ChevronDown size={12} style={{ opacity: 0.6 }} />
              </button>
              {exportMenuOpen && (
                <>
                  <div
                    style={{ position: "fixed", inset: 0, zIndex: 40 }}
                    onClick={() => setExportMenuOpen(false)}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      right: 0,
                      zIndex: 50,
                      width: 260,
                      background: "#fff",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      boxShadow: "var(--shadow-md)",
                      padding: 4,
                    }}
                  >
                    <a
                      href={`/api/export/campaigns?format=summary&days=${exportDays}`}
                      className="export-menu-item"
                      onClick={() => setExportMenuOpen(false)}
                    >
                      <Table2 size={14} />
                      <span>
                        <strong>{t("exportSummary")}</strong>
                        <span className="export-menu-hint">{t("exportSummaryHint")}</span>
                      </span>
                    </a>
                    <a
                      href={`/api/export/campaigns?format=timeseries&days=${exportDays}`}
                      className="export-menu-item"
                      onClick={() => setExportMenuOpen(false)}
                    >
                      <CalendarRange size={14} />
                      <span>
                        <strong>{t("exportTimeseries")}</strong>
                        <span className="export-menu-hint">{t("exportTimeseriesHint")}</span>
                      </span>
                    </a>
                  </div>
                </>
              )}
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => router.push("/campaigns/kickstart")}
              title="Spin up a full campaign's worth of tracked links from a playbook"
            >
              <Rocket size={13} /> {t("kickstart")}
            </button>
            <button className="btn btn-primary" onClick={() => router.push("/links/new")}>
              <Plus size={13} /> {t("createLinkWithUTM")}
            </button>
          </>
        }
      />

      {/* KPI row */}
      <div className="kpi-row kpi-row-3">
        <div className="kpi">
          <div className="kpi-label">
            <Megaphone size={12} /> {t("activeCampaigns")}
          </div>
          <div className="kpi-value">{data ? totals.active : "—"}</div>
          <div className="kpi-sub">
            <strong>{totals.upcoming}</strong> {t("statusUpcoming")} · <strong>{totals.ended}</strong> {t("statusCompleted")} · <strong>{totals.archived}</strong> {t("archivedCount")}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">
            <MousePointerClick size={12} /> {t("clicksIn", { window: windowLabel })}
          </div>
          <div className="kpi-value">{data ? totals.clicks.toLocaleString() : "—"}</div>
          <div className="kpi-sub">
            {data && totals.visible > 0
              ? t("acrossNCampaigns", { n: totals.visible })
              : "—"}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">
            <Flag size={12} /> {t("campaignsWithGoal")}
          </div>
          <div className="kpi-value">
            {data ? `${totals.withGoal} / ${totals.visible}` : "—"}
          </div>
          <div className="kpi-sub muted">
            {totals.withGoal === 0 ? t("setGoalsToTrack") : t("trackingTowardTarget")}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="segmented">
          {windowPresets.map((p) => (
            <button
              key={p.value}
              className={window === p.value ? "active" : ""}
              onClick={() => setWindow(p.value)}
            >
              {p.value === "period" ? t("periodPreset") : p.value === "all" ? t("allTime") : p.value}
            </button>
          ))}
        </div>
        <div className="search">
          <Search size={14} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setSearchQuery("")}
              aria-label={tCommon("clear")}
              title={tCommon("clear")}
            >
              <X size={12} />
            </button>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <div className="chip-row">
          {[
            { k: "", l: t("allStatuses") || "All Statuses" },
            { k: "running", l: t("statusActive") },
            { k: "upcoming", l: t("statusUpcoming") },
            { k: "ended", l: t("statusCompleted") },
            { k: "archived", l: t("statusArchived") },
          ].map((s) => (
            <button
              key={s.k || "all"}
              className={`chip ${statusFilter === s.k ? "active" : ""}`}
              onClick={() => setStatusFilter(s.k)}
            >
              {s.l}
            </button>
          ))}
        </div>
      </div>

      {/* Overlay chart */}
      {overlaySeries && data?.timeseries && (
        <div className="card card-padded" style={{ marginBottom: 14 }}>
          <div className="row-between" style={{ marginBottom: 10 }}>
            <div className="section-title">
              <LineChartIcon size={14} style={{ color: "var(--brand-500)" }} />
              {t("compareTitle", { n: selected.size })}
              <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
                · {window === "all" || isPeriod ? t("allTime") : t("dailyClicksSuffix", { days: data.meta.days })}
              </span>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button
                className="btn btn-secondary"
                onClick={() =>
                  router.push(
                    `/campaigns/compare?names=${Array.from(selected)
                      .map((n) => encodeURIComponent(n))
                      .join(",")}`,
                  )
                }
              >
                {t("sideBySideDetails")} <ArrowRight size={12} />
              </button>
              <button className="btn btn-ghost" onClick={() => setSelected(new Set())}>
                {tCommon("clear")}
              </button>
            </div>
          </div>
          <MultiCampaignChart dates={data.timeseries.dates} series={overlaySeries} />
        </div>
      )}

      {/* Leaderboard */}
      <div className="tbl-wrap">
        <div className="tbl-head">
          <div className="tbl-head-title">
            <Trophy size={14} style={{ color: "var(--data-amber)" }} />
            {t("leaderboard")}
            <span className="muted">· {windowLabel}</span>
            {selected.size > 0 && (
              <span style={{ color: "var(--brand-600)", fontSize: 11.5, marginLeft: 4 }}>
                {t("selected", { n: selected.size })} {selected.size < 2 && t("pickMoreHint")}
              </span>
            )}
          </div>
          <div className="tbl-head-tools">
            <span className="sort-label">{t("sortBy")}</span>
            {(["clicks", "goalPct", "name"] as SortKey[]).map((k) => (
              <button
                key={k}
                className={sortKey === k ? "active" : ""}
                onClick={() => setSortKey(k)}
              >
                {k === "goalPct"
                  ? t("sortGoalPct")
                  : k === "name"
                    ? t("sortName")
                    : t("sortClicks")}
              </button>
            ))}
          </div>
        </div>

        {loading && !data ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--ink-500)" }} />
          </div>
        ) : campaigns.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", fontSize: 13, color: "var(--ink-500)" }}>
            {searchQuery || statusFilter
              ? t("noCampaignsMatch")
              : t("noCampaignsYet")}
          </div>
        ) : (
          <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>{t("title")}</th>
                <th style={{ width: 110 }}>{t("colStatus")}</th>
                <th className="num" style={{ width: 70 }}>{t("colLinks")}</th>
                <th className="num" style={{ width: 180 }}>{t("colClicks")}</th>
                <th style={{ width: 130 }} title={t("col7dTrendTooltip")}>{t("col7dTrend")}</th>
                <th style={{ width: 110 }}>{t("colLastActivity")}</th>
                <th style={{ width: 130 }}>{t("colGoal")}</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const isSelected = selected.has(c.name);
                const selectionFull = !isSelected && selected.size >= MAX_SELECTION;
                return (
                  <tr
                    key={c.name}
                    onClick={() => router.push(`/campaigns/${encodeURIComponent(c.name)}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        className={`cbx ${isSelected ? "checked" : ""}`}
                        disabled={selectionFull}
                        onClick={() => toggleSelected(c.name)}
                        aria-label={isSelected ? tCommon("remove") : tCommon("confirm")}
                        title={
                          selectionFull
                            ? t("maxSelection", { max: MAX_SELECTION })
                            : isSelected
                              ? t("removeFromComparison")
                              : t("addToComparison")
                        }
                      />
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <span className="campaign-name" style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.displayName || c.name}
                        </span>
                        {c.displayName && (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-500)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {c.name}
                          </span>
                        )}
                        {shortPeriod(c, t("periodOngoing")) && (
                          <span style={{ fontSize: 11, color: "var(--ink-500)", fontVariantNumeric: "tabular-nums" }}>
                            {shortPeriod(c, t("periodOngoing"))}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {c.id ? (
                        <span className={`badge ${PHASE_BADGE[c.phase ?? "running"]}`}>
                          <span className="badge-dot" />
                          {phaseLabel(c.phase ?? "running")}
                        </span>
                      ) : (
                        <span className="muted" style={{ fontSize: 11, fontStyle: "italic" }}>
                          {t("utmOnly")}
                        </span>
                      )}
                    </td>
                    <td className="num">{c.linkCount}</td>
                    <td className="num">
                      <div className="bar-cell">
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{ width: `${(shownClicks(c) / maxClicks) * 100}%` }}
                          />
                        </div>
                        <span className="num">{shownClicks(c).toLocaleString()}</span>
                      </div>
                    </td>
                    <td>
                      {(() => {
                        // Defensive: cached payloads from before these
                        // fields existed may still be served by Redis on
                        // first request after a deploy.
                        const sparkline = c.sparkline ?? [];
                        const trendState = c.trendState ?? "none";
                        const trendPct = c.trendPct ?? null;
                        return sparkline.some((v) => v > 0) || trendState !== "none" ? (
                          <TrendCell
                            sparkline={sparkline}
                            trendPct={trendPct}
                            trendState={trendState}
                          />
                        ) : (
                          <span className="muted">—</span>
                        );
                      })()}
                    </td>
                    <td>
                      {c.lastClickAt ? (
                        <span
                          style={{ fontSize: 13, color: "var(--ink-300)" }}
                          title={new Date(c.lastClickAt).toLocaleString()}
                        >
                          {formatRelativeTime(new Date(c.lastClickAt), tCommon)}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {c.goalPct !== null && c.goalClicks ? (
                        (() => {
                          // Pace line: where an even pace would be today
                          // (running campaigns with both dates only).
                          const pace = c.phase === "running" ? goalPaceFraction(c, nowMs) : null;
                          const reached = c.goalPct >= 100;
                          const behind = !reached && pace !== null && c.goalPct < pace * 100;
                          return (
                            <div
                              className="bar-cell"
                              title={
                                pace !== null
                                  ? `${t("goalBasisTooltip")}\n${t("goalPaceTooltip", { pct: Math.round(pace * 100) })}`
                                  : t("goalBasisTooltip")
                              }
                            >
                              <div className="bar-track-wrap">
                                <div className="bar-track" style={{ minWidth: 50 }}>
                                  <div
                                    className="bar-fill"
                                    style={{
                                      width: `${Math.min(100, c.goalPct)}%`,
                                      background: reached
                                        ? "var(--data-emerald)"
                                        : behind
                                          ? "var(--data-amber)"
                                          : "var(--data-violet)",
                                    }}
                                  />
                                </div>
                                {!reached && pace !== null && pace > 0 && pace < 1 && (
                                  <span className="bar-pace" style={{ left: `${pace * 100}%` }} />
                                )}
                              </div>
                              <span
                                className="num"
                                style={{
                                  color: reached ? "var(--ok-fg)" : behind ? "var(--warn-fg)" : "var(--ink-400)",
                                }}
                              >
                                {c.goalPct.toFixed(0)}%
                              </span>
                            </div>
                          );
                        })()
                      ) : (
                        <span className="placeholder">{t("noGoal")}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <p style={{ marginTop: 14, fontSize: 11.5, color: "var(--ink-500)" }}>
        {t("compareTip")}
      </p>

      {/* Orphan links */}
      {data && data.orphans.length > 0 && (
        <div
          className="tbl-wrap"
          style={{ marginTop: 20, borderColor: "#FCD5B5", background: "#FFFBF5" }}
        >
          <div className="tbl-head" style={{ background: "#FFF7EC", borderColor: "#FCD5B5" }}>
            <div className="tbl-head-title">
              <Link2 size={14} style={{ color: "var(--data-amber)" }} />
              {t("orphanLinks")}
              <span className="muted">
                {t("orphansNotTied", { n: data.meta.totalOrphans })}
              </span>
            </div>
            <span className="muted" style={{ fontSize: 11.5 }}>
              {t("showingTopN", { n: data.orphans.length })}
            </span>
          </div>
          <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>{t("detail.colLink")}</th>
                <th>{t("colDestination")}</th>
                <th className="num" style={{ width: 90 }}>{t("colClicks")}</th>
                <th style={{ width: 110 }}>{t("colLastClick")}</th>
                <th style={{ width: 160 }}>{tCommon("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {data.orphans.map((o) => (
                <tr key={o.id}>
                  <td>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 12.5,
                          fontWeight: 500,
                          color: "var(--ink-100)",
                          maxWidth: 200,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {o.title || `/${o.code}`}
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--brand-600)" }}>
                        /{o.code}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      title={o.originalUrl}
                      style={{
                        fontSize: 12,
                        color: "var(--ink-400)",
                        maxWidth: 340,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "inline-block",
                      }}
                    >
                      {o.originalUrl.replace(/^https?:\/\//, "")}
                    </span>
                  </td>
                  <td className="num">{o.clicks.toLocaleString()}</td>
                  <td>
                    {o.lastClickAt ? (
                      <span
                        style={{ fontSize: 13, color: "var(--ink-300)" }}
                        title={new Date(o.lastClickAt).toLocaleString()}
                      >
                        {formatRelativeTime(new Date(o.lastClickAt), tCommon)}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost"
                      style={{ color: "var(--brand-600)", height: 28, padding: "0 8px" }}
                      onClick={() => router.push(`/links/${o.id}`)}
                    >
                      {t("assignCampaign")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </>
  );
}
