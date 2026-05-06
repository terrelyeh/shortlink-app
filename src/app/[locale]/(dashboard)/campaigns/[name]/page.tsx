"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link2,
  MousePointerClick,
  Megaphone,
  BarChart3,
  Copy,
  Check,
  Loader2,
  Plus,
  ExternalLink,
  Target,
  Pencil,
  Settings2,
  X,
  LineChart as LineChartIcon,
  Users,
  Globe2,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { ClicksChart } from "@/components/analytics/ClicksChart";
import { PieChartComponent } from "@/components/analytics/PieChartComponent";
import { TrendCell, classifyTrend, type TrendState } from "@/components/analytics/TrendCell";
import { formatRelativeTime } from "@/lib/utils/format";
import { computeAnalytics, type RawAnalyticsData } from "@/lib/analytics/compute";
import { PageHeader } from "@/components/layout/PageHeader";
import { SyncButton } from "@/components/layout/SyncButton";

interface CampaignLink {
  id: string;
  code: string;
  originalUrl: string;
  title: string | null;
  status: string;
  createdAt: string;
  utmCampaign: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmContent: string | null;
  _count: { clicks: number; conversions?: number };
}

type TabId = "overview" | "traffic" | "links";

/**
 * Campaign Detail page — the marketer's daily "mission control" for one
 * campaign. Three tabs: Overview, Traffic, Links.
 */
export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { success } = useToast();
  const t = useTranslations("campaigns.detail");
  const tCampaigns = useTranslations("campaigns");
  const tCommon = useTranslations("common");
  // Test-click filter strings live in the analytics namespace because
  // the same UI shows up on /analytics — keeping one source of truth.
  const tAnalytics = useTranslations("analytics");
  const campaignName = decodeURIComponent(params.name as string);

  const qc = useQueryClient();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [goalSaving, setGoalSaving] = useState(false);

  // Delete dialog: two outcomes — `unlink` keeps short URLs functional,
  // `pauseAll` stops every link in this campaign at once. Defaults to
  // unlink so a stray confirm-click can't break a live campaign.
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pauseLinksOnDelete, setPauseLinksOnDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const shortBaseUrl = process.env.NEXT_PUBLIC_SHORT_URL || "http://localhost:3000/s";

  // Pre-launch test click filter. Off by default — campaign metrics
  // show real traffic only. Toggle to include clicks the redirect
  // handler flagged as internal.
  const [includeInternal, setIncludeInternal] = useState(false);
  // Both keys depend on includeInternal so toggling refetches with the
  // right filter. campaign-links carries it for the KPI / table; the
  // raw analytics carries it for charts and breakdowns.
  const linksKey = useMemo(
    () => ["campaign-links", campaignName, includeInternal ? "with-internal" : "real-only"] as const,
    [campaignName, includeInternal],
  );
  const goalKey = useMemo(() => ["campaign-goal", campaignName] as const, [campaignName]);
  // Raw analytics are expensive to fetch (up to 2MB) and used by many
  // pages — share the same key everywhere so only one network call
  // happens across /analytics, /campaigns/[name], /campaigns/compare.
  const rawKey = useMemo(
    () => ["analytics-raw", includeInternal ? "with-internal" : "real-only"] as const,
    [includeInternal],
  );

  const { data: linksData, isLoading: loading } = useQuery({
    queryKey: linksKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        campaign: campaignName,
        limit: "100",
        sortBy: "clicks",
        sortOrder: "desc",
      });
      if (includeInternal) params.set("includeInternal", "1");
      const response = await fetch(`/api/links?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load links");
      const data = await response.json();
      return (data.links || []) as CampaignLink[];
    },
  });
  const links = useMemo(() => linksData ?? [], [linksData]);

  const { data: goalData } = useQuery({
    queryKey: goalKey,
    queryFn: async () => {
      const response = await fetch(`/api/utm-campaigns/${encodeURIComponent(campaignName)}`);
      if (!response.ok) return { goalClicks: null as number | null };
      return (await response.json()) as { goalClicks: number | null };
    },
  });
  const goalClicks = goalData?.goalClicks ?? null;

  const { data: raw, isLoading: rawLoading } = useQuery<RawAnalyticsData>({
    queryKey: rawKey,
    queryFn: async () => {
      const url = includeInternal
        ? "/api/analytics/raw?includeInternal=1"
        : "/api/analytics/raw";
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to load raw analytics");
      return (await response.json()) as RawAnalyticsData;
    },
  });

  const computed = useMemo(() => {
    if (!raw) return null;
    const rangeEnd = new Date();
    const rangeStart = new Date();
    rangeStart.setDate(rangeEnd.getDate() - 30);
    return computeAnalytics(raw, { rangeStart, rangeEnd, campaign: campaignName });
  }, [raw, campaignName]);

  // Per-link metrics from the raw click stream — single pass over all
  // clicks keyed by shortLinkId, so we don't re-scan N times per link.
  // Covers: unique visitors (ipHash distinct), last click, 7d trend
  // (last 7d vs previous 7d), and a 7-day sparkline.
  // `raw.clicks` is capped at 90 days / 10k rows by the API; values
  // beyond that window are simply absent — we surface "—" in the UI.
  const perLinkMetrics = useMemo(() => {
    const empty = () => ({
      uniques: new Set<string>(),
      lastClickAt: null as Date | null,
      last7d: 0,
      prev7d: 0,
      daily: new Array(7).fill(0) as number[],
    });
    const acc = new Map<string, ReturnType<typeof empty>>();
    for (const l of links) acc.set(l.id, empty());
    if (!raw) {
      return new Map<
        string,
        {
          uniqueClicks: number;
          lastClickAt: Date | null;
          trendPct: number | null;
          trendState: "up" | "down" | "flat" | "new" | "dead" | "none";
          sparkline: number[];
        }
      >();
    }
    const now = Date.now();
    const DAY = 86400000;
    for (const c of raw.clicks) {
      const m = acc.get(c.shortLinkId);
      if (!m) continue;
      if (c.ipHash) m.uniques.add(c.ipHash);
      const ts = new Date(c.timestamp);
      if (!m.lastClickAt || ts > m.lastClickAt) m.lastClickAt = ts;
      const ageMs = now - ts.getTime();
      if (ageMs < 7 * DAY) {
        m.last7d++;
        const daysAgo = Math.floor(ageMs / DAY);
        if (daysAgo >= 0 && daysAgo < 7) m.daily[6 - daysAgo]++;
      } else if (ageMs < 14 * DAY) {
        m.prev7d++;
      }
    }
    const out = new Map<
      string,
      {
        uniqueClicks: number;
        lastClickAt: Date | null;
        trendPct: number | null;
        trendState: TrendState;
        sparkline: number[];
      }
    >();
    for (const [id, m] of acc) {
      const { trendState, trendPct } = classifyTrend(m.last7d, m.prev7d);
      out.set(id, {
        uniqueClicks: m.uniques.size,
        lastClickAt: m.lastClickAt,
        trendPct,
        trendState,
        sparkline: m.daily,
      });
    }
    return out;
  }, [raw, links]);

  const saveGoal = async () => {
    const parsed = parseInt(goalInput, 10);
    if (isNaN(parsed) || parsed < 1) return;
    setGoalSaving(true);
    try {
      const response = await fetch(`/api/utm-campaigns/${encodeURIComponent(campaignName)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalClicks: parsed }),
      });
      if (response.ok) {
        // Optimistic update + invalidate both the goal query and the
        // Campaigns leaderboard so goal progress % stays consistent.
        qc.setQueryData(goalKey, { goalClicks: parsed });
        qc.invalidateQueries({ queryKey: ["campaigns-summary"] });
        setEditingGoal(false);
        success(t("goalSaved"));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGoalSaving(false);
    }
  };

  const clearGoal = async () => {
    setGoalSaving(true);
    try {
      const response = await fetch(`/api/utm-campaigns/${encodeURIComponent(campaignName)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalClicks: null }),
      });
      if (response.ok) {
        qc.setQueryData(goalKey, { goalClicks: null });
        qc.invalidateQueries({ queryKey: ["campaigns-summary"] });
        setGoalInput("");
        setEditingGoal(false);
        success(t("goalRemoved"));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGoalSaving(false);
    }
  };

  const totalClicks = links.reduce((sum, l) => sum + l._count.clicks, 0);
  const activeLinks = links.filter((l) => l.status === "ACTIVE").length;
  const totalCampaignClicks = totalClicks || 1;

  // Campaign-level 7d trend — sub-line on the "Total clicks" KPI so users
  // see "全時段 X / 最近 7 天 Y ↑Z%" without context-switching to /analytics.
  // Independent useMemo (vs reusing perLinkMetrics) so this stays accurate
  // even when the toggle changes raw payload — both this and the table
  // recompute from the same source of truth.
  const campaignTrend = useMemo(() => {
    if (!raw) return { last7d: 0, prev7d: 0 };
    const linkIds = new Set(links.map((l) => l.id));
    const now = Date.now();
    const DAY = 86400000;
    let last7d = 0;
    let prev7d = 0;
    for (const c of raw.clicks) {
      if (!linkIds.has(c.shortLinkId)) continue;
      const ageMs = now - new Date(c.timestamp).getTime();
      if (ageMs < 7 * DAY) last7d++;
      else if (ageMs < 14 * DAY) prev7d++;
    }
    return { last7d, prev7d };
  }, [raw, links]);
  const campaignTrendClassified = classifyTrend(
    campaignTrend.last7d,
    campaignTrend.prev7d,
  );

  const copyLink = async (shortUrl: string, id: string) => {
    await navigator.clipboard.writeText(shortUrl);
    setCopiedId(id);
    success(tCommon("copied"));
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/utm-campaigns/${encodeURIComponent(campaignName)}?pauseLinks=${pauseLinksOnDelete}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : `HTTP ${res.status}`,
        );
      }

      success(
        pauseLinksOnDelete
          ? t("deleteSuccessWithPause", { count: data.pausedCount ?? 0 })
          : t("deleteSuccess"),
      );

      // Bust the caches that surface this campaign so it doesn't
      // ghost-show in lists after we navigate back.
      qc.invalidateQueries({ queryKey: ["campaigns-summary"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["analytics-raw"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["utm-campaigns"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["links"], refetchType: "all" });

      router.push("/campaigns");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  };

  const copyAllLinks = async () => {
    const all = links.map((l) => `${shortBaseUrl}/${l.code}`).join("\n");
    await navigator.clipboard.writeText(all);
    setCopiedAll(true);
    success(t("allLinksCopied"));
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const statusBadgeClass: Record<string, string> = {
    ACTIVE: "active",
    PAUSED: "paused",
    ARCHIVED: "archived",
  };

  return (
    <>
      <PageHeader
        back={t("backToCampaigns")}
        onBack={() => router.push("/campaigns")}
        title={
          <div className="campaign-hero" style={{ marginBottom: 0 }}>
            <div className="campaign-icon">
              <Megaphone size={20} />
            </div>
            <div>
              <div className="campaign-kind">{t("utmCampaignBadge")}</div>
              <h1>{campaignName}</h1>
            </div>
          </div>
        }
        actions={
          <>
            <SyncButton queryKeys={[[...linksKey], [...goalKey], [...rawKey]]} />
            <button
              className="btn btn-secondary"
              onClick={copyAllLinks}
              disabled={links.length === 0}
            >
              {copiedAll ? <Check size={13} /> : <Copy size={13} />}
              {copiedAll ? tCommon("copied") : t("copyAllLinks")}
            </button>
            <Link
              href={`/links/new?utmCampaign=${encodeURIComponent(campaignName)}`}
              className="btn btn-primary"
            >
              <Plus size={13} /> {t("addLink")}
            </Link>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setPauseLinksOnDelete(false);
                setDeleteOpen(true);
              }}
              title={t("deleteCampaign")}
              style={{ color: "var(--err-fg)" }}
            >
              <Trash2 size={13} />
            </button>
          </>
        }
      />

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl border border-slate-200 p-6 max-w-md w-full mx-4 z-10">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-red-100">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              {t("deleteDialogTitle", { name: campaignName })}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {t("deleteDialogBody", { count: links.length })}
            </p>

            <label
              className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                pauseLinksOnDelete
                  ? "border-red-300 bg-red-50"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <input
                type="checkbox"
                checked={pauseLinksOnDelete}
                onChange={(e) => setPauseLinksOnDelete(e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-medium text-slate-900">
                  {t("deleteAlsoPauseLabel")}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {t("deleteAlsoPauseHelp")}
                </div>
              </div>
            </label>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {tCommon("cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {pauseLinksOnDelete
                  ? t("deleteAndPauseConfirm")
                  : t("deleteConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test-click filter — between hero and KPI row so the indicator
          + toggle is immediately near the numbers it affects. The toggle
          itself is a small inline checkbox; the banner only appears when
          ≥ 1 click was excluded so it doesn't clutter the page when the
          campaign has no test traffic. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
          padding: "8px 12px",
          background: "var(--bg-subtle)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          fontSize: 12.5,
          color: "var(--ink-400)",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {!includeInternal && (raw?.meta.excludedInternal ?? 0) > 0
            ? tAnalytics("filteredTestClicks", { n: raw?.meta.excludedInternal ?? 0 })
            : includeInternal
              ? tAnalytics("includingTestClicks")
              : tAnalytics("realTrafficOnly")}
        </span>
        <button
          type="button"
          onClick={() => setIncludeInternal((v) => !v)}
          className={`input ${includeInternal ? "filter-active" : ""}`}
          style={{
            height: 28,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "0 10px",
            cursor: "pointer",
            fontSize: 12,
          }}
          title={tAnalytics("includeTestTip")}
        >
          <span
            style={{
              width: 12,
              height: 12,
              border: "1.5px solid currentColor",
              borderRadius: 3,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 9,
              lineHeight: 1,
            }}
          >
            {includeInternal ? "✓" : ""}
          </span>
          {tAnalytics("includeTest")}
        </button>
      </div>

      {/* KPI Row */}
      <div className="kpi-row" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="kpi">
          <div className="kpi-label">
            <Link2 size={12} /> {t("kpiLinks")}
          </div>
          <div className="kpi-value">{links.length}</div>
          <div className="kpi-sub pos">● {t("kpiActive", { n: activeLinks })}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">
            <MousePointerClick size={12} /> {t("kpiTotalClicks")}
          </div>
          <div className="kpi-value">{totalClicks.toLocaleString()}</div>
          {/* Sub-line: "全時段 · 最近 7 天 N ↑X%" — the all-time number
              is the headline, the 7-day breakdown gives recency context
              so users don't have to bounce to /analytics for it. */}
          <div
            className="kpi-sub"
            style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
          >
            <span>{t("kpiAllTime")}</span>
            <span style={{ color: "var(--ink-500)" }}>·</span>
            <span>
              {tAnalytics("range7d")}{" "}
              <strong style={{ color: "var(--ink-200)", fontVariantNumeric: "tabular-nums" }}>
                {campaignTrend.last7d.toLocaleString()}
              </strong>
            </span>
            {campaignTrendClassified.trendState === "up" && campaignTrendClassified.trendPct !== null && (
              <span style={{ color: "#16a34a", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                ↑{Math.abs(campaignTrendClassified.trendPct)}%
              </span>
            )}
            {campaignTrendClassified.trendState === "down" && campaignTrendClassified.trendPct !== null && (
              <span style={{ color: "#dc2626", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                ↓{Math.abs(campaignTrendClassified.trendPct)}%
              </span>
            )}
            {campaignTrendClassified.trendState === "new" && (
              <span style={{ color: "var(--brand-700)", fontWeight: 600 }}>
                {tAnalytics("trendNew")}
              </span>
            )}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">
            <BarChart3 size={12} /> {t("kpiAvgClicks")}
          </div>
          <div className="kpi-value">
            {links.length > 0 ? Math.round(totalClicks / links.length).toLocaleString() : "0"}
          </div>
          <div className="kpi-sub">{t("kpiPerLink")}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={activeTab === "overview" ? "active" : ""}
          onClick={() => setActiveTab("overview")}
        >
          <LineChartIcon size={13} /> {t("tabOverview")}
        </button>
        <button
          className={activeTab === "traffic" ? "active" : ""}
          onClick={() => setActiveTab("traffic")}
        >
          <Users size={13} /> {t("tabTraffic")}
        </button>
        <button
          className={activeTab === "links" ? "active" : ""}
          onClick={() => setActiveTab("links")}
        >
          <Link2 size={13} /> {t("tabLinks")}
        </button>
      </div>

      {/* Overview tab */}
      {activeTab === "overview" && (
        <>
          {/* Goal card */}
          <div className="goal-card">
            <div className="goal-head">
              <div className="section-title">
                <Target size={14} style={{ color: "var(--data-violet)" }} />
                {t("clickGoal")}
                {goalClicks && (
                  <span className="muted" style={{ fontFamily: "var(--font-mono)", fontWeight: 400, fontSize: 11.5 }}>
                    {totalClicks.toLocaleString()} / {goalClicks.toLocaleString()}
                  </span>
                )}
              </div>
              <div className="row" style={{ gap: 4 }}>
                {goalClicks && !editingGoal && (
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "4px 6px" }}
                    onClick={clearGoal}
                    title={t("removeGoal")}
                  >
                    <X size={13} />
                  </button>
                )}
                <button
                  className="btn btn-ghost"
                  style={{ padding: "4px 6px" }}
                  onClick={() => {
                    setEditingGoal(!editingGoal);
                    setGoalInput(goalClicks ? String(goalClicks) : "");
                  }}
                  title={t("editGoal")}
                >
                  <Pencil size={13} />
                </button>
              </div>
            </div>

            {editingGoal ? (
              <div className="row" style={{ gap: 8 }}>
                <input
                  type="number"
                  min={1}
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveGoal();
                    if (e.key === "Escape") setEditingGoal(false);
                  }}
                  placeholder={t("goalPlaceholder")}
                  className="input"
                  style={{ flex: 1, height: 32 }}
                  autoFocus
                />
                <button
                  className="btn btn-primary"
                  onClick={saveGoal}
                  disabled={!goalInput || goalSaving}
                >
                  {goalSaving ? <Loader2 size={13} className="animate-spin" /> : tCommon("save")}
                </button>
                <button className="btn btn-secondary" onClick={() => setEditingGoal(false)}>
                  {tCommon("cancel")}
                </button>
              </div>
            ) : goalClicks ? (
              (() => {
                const pct = Math.min((totalClicks / goalClicks) * 100, 100);
                const reached = totalClicks >= goalClicks;
                return (
                  <>
                    <div className="goal-progress">
                      <div style={{ width: `${pct}%` }} />
                    </div>
                    <div className="row-between" style={{ marginTop: 4 }}>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 500,
                          color: reached ? "var(--ok-fg)" : "var(--data-violet)",
                        }}
                      >
                        {reached ? t("goalReached") : t("goalPct", { pct: pct.toFixed(1) })}
                      </span>
                      <span className="muted" style={{ fontSize: 11.5 }}>
                        {t("clicksRemaining", { n: (goalClicks - totalClicks).toLocaleString() })}
                      </span>
                    </div>
                  </>
                );
              })()
            ) : (
              <p className="placeholder" style={{ margin: 0 }}>
                {t("setGoalHint")}
              </p>
            )}
          </div>

          {/* Trend chart */}
          <div className="card card-padded">
            <div className="section-title" style={{ marginBottom: 10 }}>
              <LineChartIcon size={14} style={{ color: "var(--ink-400)" }} />
              {t("clicksTitle")}
              <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
                {t("last30Days")}
              </span>
            </div>
            {rawLoading ? (
              <div style={{ height: 300, display: "grid", placeItems: "center" }}>
                <Loader2 size={20} className="animate-spin" style={{ color: "var(--ink-500)" }} />
              </div>
            ) : computed && computed.clicksByDay.length > 0 ? (
              <ClicksChart data={computed.clicksByDay} />
            ) : (
              <div style={{ height: 300, display: "grid", placeItems: "center", fontSize: 13, color: "var(--ink-500)" }}>
                {t("noClicks30d")}
              </div>
            )}
          </div>
        </>
      )}

      {/* Traffic tab */}
      {activeTab === "traffic" && (
        <div className="stack" style={{ gap: 14 }}>
          {rawLoading ? (
            <div className="card" style={{ padding: 48, display: "grid", placeItems: "center" }}>
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--ink-500)" }} />
            </div>
          ) : !computed || computed.summary.totalClicks === 0 ? (
            <div
              className="card"
              style={{ padding: 48, textAlign: "center", fontSize: 13, color: "var(--ink-500)" }}
            >
              {t("noTraffic30d")}
            </div>
          ) : (
            <>
              <div className="grid-2">
                <TopList
                  title={t("topSources")}
                  subtitle={t("topSourcesHint")}
                  rows={computed.utm.sources}
                  total={computed.summary.totalClicks}
                  pillClass="pill-source"
                  noDataLabel={t("noData")}
                />
                <TopList
                  title={t("topMediums")}
                  subtitle={t("topMediumsHint")}
                  rows={computed.utm.mediums}
                  total={computed.summary.totalClicks}
                  pillClass="pill-medium"
                  noDataLabel={t("noData")}
                />
              </div>

              <div className="card card-padded">
                <div className="section-title" style={{ marginBottom: 14 }}>
                  {t("audienceBreakdown")}
                </div>
                <div className="grid-3">
                  <PieChartComponent data={computed.devices} title={t("device")} />
                  <PieChartComponent data={computed.browsers} title={t("browser")} />
                  <PieChartComponent data={computed.operatingSystems} title={t("os")} />
                </div>
              </div>

              <div className="grid-2">
                <TopList
                  title={t("topCountries")}
                  rows={computed.countries.map((c) => ({ name: c.name, clicks: c.value }))}
                  total={computed.summary.totalClicks}
                  pillClass="pill-country"
                  icon={<Globe2 size={14} style={{ color: "var(--ink-400)" }} />}
                  noDataLabel={t("noData")}
                />
                <TopList
                  title={t("topReferrers")}
                  rows={computed.referrers.map((r) => ({ name: r.name, clicks: r.value }))}
                  total={computed.summary.totalClicks}
                  pillClass="pill-content"
                  noDataLabel={t("noData")}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Links tab */}
      {activeTab === "links" && (
        <div className="tbl-wrap">
          <div className="tbl-head">
            <div className="tbl-head-title">
              {t("linksInCampaign")}
              <span className="muted">{t("linksSortedByClicks", { n: links.length })}</span>
            </div>
            <Link
              href={`/links/new?utmCampaign=${encodeURIComponent(campaignName)}`}
              className="btn btn-secondary"
              style={{ height: 28, fontSize: 11.5 }}
            >
              <Plus size={12} /> {t("addLink")}
            </Link>
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: "center" }}>
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--ink-500)" }} />
            </div>
          ) : links.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "var(--ink-500)", marginBottom: 12 }}>
                {t("noLinksInCampaign")}
              </p>
              <Link
                href={`/links/new?utmCampaign=${encodeURIComponent(campaignName)}`}
                className="btn btn-primary"
              >
                <Plus size={13} /> {t("createFirstLink")}
              </Link>
            </div>
          ) : (
            <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>{t("colLink")}</th>
                  <th>{t("colCampaignSourceMediumContent")}</th>
                  <th style={{ width: 100 }}>{tCampaigns("colStatus")}</th>
                  <th className="num" style={{ width: 100 }}>
                    {tCampaigns("colClicks")}
                  </th>
                  <th className="num" style={{ width: 80 }} title={t("colUniqueTooltip")}>
                    {t("colUnique")}
                  </th>
                  <th className="num" style={{ width: 75 }} title={t("colShareTooltip")}>
                    {t("colShare")}
                  </th>
                  <th style={{ width: 120 }} title={tCampaigns("col7dTrendTooltip")}>
                    {t("col7dTrend")}
                  </th>
                  <th style={{ width: 110 }}>{t("colLastClick")}</th>
                  <th style={{ width: 140 }}>{tCommon("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => {
                  const shortUrl = `${shortBaseUrl}/${link.code}`;
                  const m = perLinkMetrics.get(link.id);
                  const sharePct = (link._count.clicks / totalCampaignClicks) * 100;
                  return (
                    <tr key={link.id}>
                      <td>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 13.5,
                              fontWeight: 500,
                              color: "var(--ink-100)",
                              maxWidth: 220,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {link.title || `/${link.code}`}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: 12,
                                color: "var(--brand-600)",
                              }}
                            >
                              /{link.code}
                            </span>
                            <button
                              className="btn btn-ghost"
                              style={{ padding: 2, height: "auto" }}
                              onClick={() => copyLink(shortUrl, link.id)}
                            >
                              {copiedId === link.id ? (
                                <Check size={11} style={{ color: "var(--ok-fg)" }} />
                              ) : (
                                <Copy size={11} style={{ color: "var(--ink-500)" }} />
                              )}
                            </button>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {link.utmCampaign ? (
                            <span className="pill pill-campaign">{link.utmCampaign}</span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                          {link.utmSource && <span className="pill pill-source">{link.utmSource}</span>}
                          {link.utmMedium && <span className="pill pill-medium">{link.utmMedium}</span>}
                          {link.utmContent && <span className="pill pill-content">{link.utmContent}</span>}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${statusBadgeClass[link.status] || "draft"}`}>
                          <span className="badge-dot" />
                          {link.status.charAt(0) + link.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="num">{link._count.clicks.toLocaleString()}</td>
                      <td className="num">
                        {m && m.uniqueClicks > 0 ? (
                          m.uniqueClicks.toLocaleString()
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="num">
                        {link._count.clicks > 0 ? (
                          <span style={{ color: "var(--ink-300)" }}>
                            {sharePct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        {m && (m.sparkline.some((v) => v > 0) || m.trendState !== "none") ? (
                          <TrendCell
                            sparkline={m.sparkline}
                            trendPct={m.trendPct}
                            trendState={m.trendState}
                          />
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        {m && m.lastClickAt ? (
                          <span
                            style={{ fontSize: 13, color: "var(--ink-300)" }}
                            title={m.lastClickAt.toLocaleString()}
                          >
                            {formatRelativeTime(m.lastClickAt, tCommon)}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Link
                            href={`/analytics?linkId=${link.id}`}
                            style={{
                              color: "var(--brand-600)",
                              fontSize: 13,
                              fontWeight: 500,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            {t("actionAnalytics")} <span style={{ fontSize: 10 }}>→</span>
                          </Link>
                          <Link
                            href={`/links/${link.id}`}
                            title={t("actionEditSettings")}
                            style={{ color: "var(--ink-500)", display: "inline-flex" }}
                          >
                            <Settings2 size={13} />
                          </Link>
                          <a
                            href={shortUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={t("actionOpenShortUrl")}
                            style={{ color: "var(--ink-500)", display: "inline-flex" }}
                          >
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function TopList({
  title,
  subtitle,
  rows,
  total,
  pillClass,
  icon,
  noDataLabel = "No data",
}: {
  title: string;
  subtitle?: string;
  rows: { name: string; clicks: number }[];
  total: number;
  pillClass: string;
  icon?: React.ReactNode;
  noDataLabel?: string;
}) {
  return (
    <div className="card card-padded">
      <div className="section-title">
        {icon}
        {title}
      </div>
      <p className="section-sub">{subtitle || "\u00a0"}</p>
      {rows.length === 0 ? (
        <p className="placeholder" style={{ textAlign: "center", padding: "24px 0" }}>
          {noDataLabel}
        </p>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {rows.slice(0, 8).map((row) => {
            const pct = total > 0 ? (row.clicks / total) * 100 : 0;
            return (
              <div key={row.name} className="row" style={{ gap: 12 }}>
                <div style={{ minWidth: 80 }}>
                  <span className={`pill ${pillClass}`} title={row.name}>
                    {row.name || "—"}
                  </span>
                </div>
                <div className="bar-track" style={{ flex: 1 }}>
                  <div className="bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12.5,
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
      )}
    </div>
  );
}
