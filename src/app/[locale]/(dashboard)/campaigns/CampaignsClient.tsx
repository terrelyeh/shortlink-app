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
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MultiCampaignChart } from "@/components/analytics/MultiCampaignChart";
import { TrendCell, type TrendState } from "@/components/analytics/TrendCell";
import { SyncButton } from "@/components/layout/SyncButton";
import { formatRelativeTime } from "@/lib/utils/format";

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

const windowPresets: { value: string; labelKey: string; days: number }[] = [
  { value: "7d", labelKey: "last7Days", days: 7 },
  { value: "30d", labelKey: "last30Days", days: 30 },
  { value: "90d", labelKey: "last90Days", days: 90 },
];

function statusClass(status: string | null): string {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "DRAFT":
      return "draft";
    case "COMPLETED":
      return "completed";
    case "ARCHIVED":
      return "archived";
    default:
      return "draft";
  }
}

export default function CampaignsClient() {
  const t = useTranslations("campaigns");
  const router = useRouter();

  const [window, setWindow] = useState<string>("30d");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("clicks");
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
      const preset = windowPresets.find((p) => p.value === window) ?? windowPresets[1];
      const res = await fetch(`/api/analytics/campaigns-summary?days=${preset.days}`);
      if (!res.ok) throw new Error("Failed to fetch campaigns summary");
      return (await res.json()) as SummaryResponse;
    },
  });

  const campaigns = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    const filtered = data.campaigns.filter((c) => {
      if (statusFilter) {
        if (c.status !== statusFilter) return false;
      } else {
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
      if (sortKey === "goalPct") return (b.goalPct ?? -1) - (a.goalPct ?? -1);
      return b.clicks - a.clicks;
    });
  }, [data, searchQuery, statusFilter, sortKey]);

  const totals = useMemo(() => {
    if (!data) return { clicks: 0, withGoal: 0, active: 0, drafts: 0, archived: 0 };
    return {
      clicks: data.campaigns.reduce((s, c) => s + c.clicks, 0),
      withGoal: data.campaigns.filter((c) => c.goalClicks).length,
      active: data.campaigns.filter((c) => c.status === "ACTIVE").length,
      drafts: data.campaigns.filter((c) => c.status === "DRAFT").length,
      archived: data.campaigns.filter((c) => c.status === "ARCHIVED").length,
    };
  }, [data]);

  const overlaySeries = useMemo(() => {
    if (!data?.timeseries || selected.size < 2) return null;
    const out: Record<string, number[]> = {};
    for (const name of selected) {
      const arr = data.timeseries.perCampaign[name];
      if (arr) out[name] = arr;
    }
    return out;
  }, [data, selected]);

  const maxClicks = Math.max(1, ...campaigns.map((c) => c.clicks));

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
                <SlidersHorizontal size={13} /> Compare {selected.size}
              </button>
            )}
            <button className="btn btn-primary" onClick={() => router.push("/links/new")}>
              <Plus size={13} /> {t("createLinkWithUTM")}
            </button>
          </>
        }
      />

      {/* KPI row */}
      <div className="kpi-row" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="kpi">
          <div className="kpi-label">
            <Megaphone size={12} /> Active campaigns
          </div>
          <div className="kpi-value">{data ? totals.active : "—"}</div>
          <div className="kpi-sub">
            <strong>{totals.drafts}</strong> drafts · <strong>{totals.archived}</strong> archived
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">
            <MousePointerClick size={12} /> Clicks · last {data?.meta.days ?? 30}d
          </div>
          <div className="kpi-value">{data ? totals.clicks.toLocaleString() : "—"}</div>
          <div className="kpi-sub">
            {data && data.campaigns.length > 0 ? `across ${data.campaigns.length} campaigns` : "—"}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">
            <Flag size={12} /> Campaigns with a goal
          </div>
          <div className="kpi-value">
            {data ? `${totals.withGoal} / ${data.campaigns.length}` : "—"}
          </div>
          <div className="kpi-sub muted">
            {totals.withGoal === 0 ? "set goals to track progress →" : "tracking toward target"}
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
              {p.value}
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
        </div>
        <div style={{ flex: 1 }} />
        <div className="chip-row">
          {[
            { k: "", l: t("allStatuses") || "All Statuses" },
            { k: "ACTIVE", l: t("statusActive") },
            { k: "DRAFT", l: t("statusDraft") },
            { k: "COMPLETED", l: t("statusCompleted") },
            { k: "ARCHIVED", l: t("statusArchived") },
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
              Compare {selected.size} campaigns
              <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
                · daily clicks, last {data.meta.days}d
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
                Side-by-side details <ArrowRight size={12} />
              </button>
              <button className="btn btn-ghost" onClick={() => setSelected(new Set())}>
                Clear
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
            Leaderboard
            <span className="muted">· last {data?.meta.days ?? 30}d</span>
            {selected.size > 0 && (
              <span style={{ color: "var(--brand-600)", fontSize: 11.5, marginLeft: 4 }}>
                {selected.size} selected {selected.size < 2 && "(pick 1 more to compare)"}
              </span>
            )}
          </div>
          <div className="tbl-head-tools">
            <span className="sort-label">Sort by</span>
            {(["clicks", "goalPct", "name"] as SortKey[]).map((k) => (
              <button
                key={k}
                className={sortKey === k ? "active" : ""}
                onClick={() => setSortKey(k)}
              >
                {k === "goalPct"
                  ? "Goal %"
                  : k.charAt(0).toUpperCase() + k.slice(1)}
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
              ? "No campaigns match your filters."
              : "No campaigns yet. Create a link with a UTM campaign value and it'll show up here."}
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>Campaign</th>
                <th style={{ width: 110 }}>Status</th>
                <th className="num" style={{ width: 70 }}>Links</th>
                <th className="num" style={{ width: 180 }}>Clicks</th>
                <th style={{ width: 130 }} title="Daily clicks over the last 7 days">7d trend</th>
                <th style={{ width: 110 }}>Last activity</th>
                <th style={{ width: 130 }}>Goal</th>
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
                        aria-label={isSelected ? "Deselect" : "Select"}
                        title={
                          selectionFull
                            ? `Max ${MAX_SELECTION} campaigns at once`
                            : isSelected
                              ? "Remove from comparison"
                              : "Add to comparison"
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
                      </div>
                    </td>
                    <td>
                      {c.status ? (
                        <span className={`badge ${statusClass(c.status)}`}>
                          <span className="badge-dot" />
                          {c.status === "ACTIVE"
                            ? t("statusActive")
                            : c.status === "DRAFT"
                              ? t("statusDraft")
                              : c.status === "COMPLETED"
                                ? t("statusCompleted")
                                : t("statusArchived")}
                        </span>
                      ) : (
                        <span className="muted" style={{ fontSize: 11, fontStyle: "italic" }}>
                          utm-only
                        </span>
                      )}
                    </td>
                    <td className="num">{c.linkCount}</td>
                    <td className="num">
                      <div className="bar-cell">
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{ width: `${(c.clicks / maxClicks) * 100}%` }}
                          />
                        </div>
                        <span className="num">{c.clicks.toLocaleString()}</span>
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
                          {formatRelativeTime(new Date(c.lastClickAt))}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {c.goalPct !== null && c.goalClicks ? (
                        <div className="bar-cell">
                          <div className="bar-track" style={{ minWidth: 50 }}>
                            <div
                              className="bar-fill"
                              style={{
                                width: `${Math.min(100, c.goalPct)}%`,
                                background: c.goalPct >= 100 ? "var(--data-emerald)" : "var(--data-violet)",
                              }}
                            />
                          </div>
                          <span
                            className="num"
                            style={{ color: c.goalPct >= 100 ? "var(--ok-fg)" : "var(--ink-400)" }}
                          >
                            {c.goalPct.toFixed(0)}%
                          </span>
                        </div>
                      ) : (
                        <span className="placeholder">no goal</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ marginTop: 14, fontSize: 11.5, color: "var(--ink-500)" }}>
        Tip: select 2 or more campaigns to compare side-by-side.
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
              Orphan links
              <span className="muted">
                · {data.meta.totalOrphans} link{data.meta.totalOrphans === 1 ? "" : "s"} not tied to any campaign
              </span>
            </div>
            <span className="muted" style={{ fontSize: 11.5 }}>
              Showing top {data.orphans.length} by clicks
            </span>
          </div>
          <table className="data">
            <thead>
              <tr>
                <th>Link</th>
                <th>Destination</th>
                <th className="num" style={{ width: 90 }}>Clicks</th>
                <th style={{ width: 110 }}>Last click</th>
                <th style={{ width: 160 }}>Actions</th>
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
                        {formatRelativeTime(new Date(o.lastClickAt))}
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
                      Assign campaign →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
