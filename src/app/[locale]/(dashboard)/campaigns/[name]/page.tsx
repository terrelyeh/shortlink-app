"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
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
  RotateCcw,
  Download,
  ChevronDown,
  Table2,
  CalendarRange,
  Share2,
  Archive,
  ArchiveRestore,
  CalendarDays,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { ClicksChart } from "@/components/analytics/ClicksChart";
import { PieChartComponent } from "@/components/analytics/PieChartComponent";
import { TrendCell, classifyTrend, type TrendState } from "@/components/analytics/TrendCell";
import { formatRelativeTime } from "@/lib/utils/format";
import {
  campaignPhase,
  type CampaignPhase,
  hasPeriod,
  periodBoundsMs,
  storedDateToDay,
} from "@/lib/campaign-period";
import { computeAnalytics, type RawAnalyticsData } from "@/lib/analytics/compute";
import { PageHeader } from "@/components/layout/PageHeader";
import { ShareModal } from "@/components/analytics/ShareModal";
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
type RangeId = "period" | "all" | "90d" | "30d";

const PHASE_BADGE: Record<CampaignPhase, string> = {
  running: "active",
  upcoming: "draft",
  ended: "completed",
  archived: "archived",
};

interface CampaignRecord {
  id: string;
  goalClicks: number | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
}

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
  const tShare = useTranslations("share");
  const campaignName = decodeURIComponent(params.name as string);
  const locale = useLocale();
  const fmtDay = (day: string) => {
    const [y, m, d] = day.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(
      new Date(y, m - 1, d),
    );
  };

  const qc = useQueryClient();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  // Chart / Traffic / KPI window. null = the default: the campaign period
  // when one is set, otherwise all time (campaigns are usually reviewed
  // after they end — a fixed 30-day window showed exhibition campaigns as
  // empty a few months later). Resolved below once the record loads.
  const [rangeChoice, setRangeChoice] = useState<RangeId | null>(null);
  const [editingPeriod, setEditingPeriod] = useState(false);
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [periodSaving, setPeriodSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [goalSaving, setGoalSaving] = useState(false);

  // Delete dialog: two outcomes — `unlink` keeps short URLs functional,
  // `pauseAll` stops every link in this campaign at once. Defaults to
  // unlink so a stray confirm-click can't break a live campaign.
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pauseLinksOnDelete, setPauseLinksOnDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset-clicks dialog. Soft reset — flags every real click for this
  // campaign as isInternal (test). Reversible via the toast action or
  // by calling restore mode on the same endpoint.
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

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

  // Campaign record (goal, period, archive). Key name is historical.
  const { data: goalData } = useQuery({
    queryKey: goalKey,
    queryFn: async () => {
      const response = await fetch(`/api/utm-campaigns/${encodeURIComponent(campaignName)}`);
      if (!response.ok) return { goalClicks: null as number | null, campaignRecord: null };
      return (await response.json()) as {
        goalClicks: number | null;
        campaignRecord: CampaignRecord | null;
      };
    },
  });
  const goalClicks = goalData?.goalClicks ?? null;
  const record = goalData?.campaignRecord ?? null;
  const periodSet = hasPeriod(record);
  const periodBounds = periodBoundsMs(record);
  const phase = campaignPhase(record ?? { startDate: null, endDate: null, status: "ACTIVE" });
  const trendRange: RangeId = rangeChoice ?? (periodSet ? "period" : "all");
  const startDay = storedDateToDay(record?.startDate);
  const endDay = storedDateToDay(record?.endDate);

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

  // Excluded-click notice for THIS campaign only (the raw payload's
  // totals are workspace-wide — showing those here was misleading).
  const excludedSummary = useMemo(() => {
    const byLink = raw?.meta.excludedByLink ?? {};
    let test = 0;
    let bot = 0;
    for (const l of links) {
      test += byLink[l.id]?.internal ?? 0;
      bot += byLink[l.id]?.bot ?? 0;
    }
    const parts = [
      test > 0 ? tAnalytics("excludedTestPart", { n: test }) : null,
      bot > 0 ? tAnalytics("excludedBotPart", { n: bot.toLocaleString() }) : null,
    ].filter(Boolean);
    return parts.join("、");
  }, [raw, links, tAnalytics]);

  // Concrete [start, end] for the selected window. Open period ends fall
  // back to the oldest raw click / now.
  const rangeDates = useMemo(() => {
    const now = Date.now();
    const sinceMs = raw ? new Date(raw.meta.since).getTime() : now - 730 * 86_400_000;
    if (trendRange === "period") {
      return {
        start: new Date(Math.max(periodBounds.fromMs, sinceMs)),
        end: new Date(Math.min(periodBounds.toMs, now)),
      };
    }
    if (trendRange === "all") return { start: new Date(sinceMs), end: new Date(now) };
    return {
      start: new Date(now - (trendRange === "90d" ? 90 : 30) * 86_400_000),
      end: new Date(now),
    };
  }, [raw, trendRange, periodBounds.fromMs, periodBounds.toMs]);

  const computed = useMemo(() => {
    if (!raw) return null;
    return computeAnalytics(raw, {
      rangeStart: rangeDates.start,
      rangeEnd: rangeDates.end,
      campaign: campaignName,
    });
  }, [raw, campaignName, rangeDates]);

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
  // KPI numbers follow the selected window (same window as the campaign
  // list's default, so the two pages agree).
  const rangeClicks = computed?.summary.totalClicks ?? null;

  // Goal progress always counts the campaign period (all time when no
  // dates are set) — the same denominator the campaign list uses,
  // whichever window is selected here.
  const goalBaseClicks = useMemo(() => {
    if (!periodSet) return totalClicks;
    if (!raw) return null;
    const linkIds = new Set(links.map((l) => l.id));
    let n = 0;
    for (const c of raw.clicks) {
      if (!linkIds.has(c.shortLinkId)) continue;
      const ts = new Date(c.timestamp).getTime();
      if (ts >= periodBounds.fromMs && ts <= periodBounds.toMs) n++;
    }
    return n;
  }, [periodSet, totalClicks, raw, links, periodBounds.fromMs, periodBounds.toMs]);

  const phaseLabel = (p: CampaignPhase) =>
    p === "running"
      ? tCampaigns("statusActive")
      : p === "upcoming"
        ? tCampaigns("statusUpcoming")
        : p === "ended"
          ? tCampaigns("statusCompleted")
          : tCampaigns("statusArchived");

  const rangeLabel = (r: RangeId) =>
    r === "period"
      ? t("rangePeriod")
      : tAnalytics(r === "all" ? "rangeAll" : r === "90d" ? "range90d" : "range30d");

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

  const patchCampaign = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/utm-campaigns/${encodeURIComponent(campaignName)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    qc.invalidateQueries({ queryKey: goalKey });
    qc.invalidateQueries({ queryKey: ["campaigns-summary"], refetchType: "all" });
  };

  const openPeriodEditor = () => {
    setStartInput(startDay ?? "");
    setEndInput(endDay ?? "");
    setEditingPeriod(true);
  };

  const savePeriod = async (clear = false) => {
    setPeriodSaving(true);
    try {
      await patchCampaign(
        clear
          ? { startDate: null, endDate: null }
          : { startDate: startInput || null, endDate: endInput || null },
      );
      // Back to the default window so the page shows the new period.
      setRangeChoice(null);
      setEditingPeriod(false);
      success(clear ? t("periodCleared") : t("periodSaved"));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setPeriodSaving(false);
    }
  };

  const toggleArchive = async () => {
    const archive = phase !== "archived";
    setArchiving(true);
    try {
      await patchCampaign({ status: archive ? "ARCHIVED" : "ACTIVE" });
      success(archive ? t("archivedToast") : t("unarchivedToast"));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setArchiving(false);
    }
  };

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

  // Soft reset — flag every real click for this campaign as test data
  // (isInternal=true with a fresh batchId). KPI / chart drop to zero;
  // data preserved + reversible. The "restore" path uses the same
  // endpoint with mode: "restore".
  const handleResetClicks = async (mode: "reset" | "restore", batchId?: string) => {
    setResetting(true);
    try {
      const res = await fetch(
        `/api/utm-campaigns/${encodeURIComponent(campaignName)}/reset-clicks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, ...(batchId ? { batchId } : {}) }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : `HTTP ${res.status}`,
        );
      }

      // Bust everything that displays click numbers — the affected
      // surfaces are: this page (links + raw), /campaigns leaderboard,
      // /analytics, /links list. refetchType: "all" forces refetch
      // even when observers are detached during navigation.
      qc.invalidateQueries({ queryKey: ["campaign-links"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["analytics-raw"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["campaigns-summary"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["links"], refetchType: "all" });

      const affected = data.affectedClicks ?? 0;
      if (mode === "reset") {
        success(t("resetSuccess", { n: affected }));
        setResetOpen(false);
      } else {
        success(t("restoreSuccess", { n: affected }));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reset clicks");
    } finally {
      setResetting(false);
    }
  };

  const statusBadgeClass: Record<string, string> = {
    ACTIVE: "active",
    PAUSED: "paused",
    ARCHIVED: "archived",
  };

  return (
    <>
      {/* Shares the period currently selected on this page, frozen. */}
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        campaignFilter={campaignName}
        period={trendRange === "all" ? "all" : rangeDates}
      />
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
              {/* Period + derived status. Status follows the dates; only
                  "archived" is set by hand. */}
              <div className="campaign-period-line">
                {record && (
                  <span className={`badge ${PHASE_BADGE[phase]}`}>
                    <span className="badge-dot" />
                    {phaseLabel(phase)}
                  </span>
                )}
                <CalendarDays size={13} style={{ color: "var(--ink-400)" }} />
                {periodSet ? (
                  <span className="campaign-period-dates">
                    {startDay ? fmtDay(startDay) : t("periodOpenStart")}
                    {" – "}
                    {endDay ? fmtDay(endDay) : t("periodOpenEnd")}
                  </span>
                ) : (
                  <span className="muted">{t("periodNotSet")}</span>
                )}
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: "2px 6px", fontSize: 12 }}
                  onClick={openPeriodEditor}
                  title={t("editPeriod")}
                >
                  {periodSet ? <Pencil size={12} /> : t("setPeriod")}
                </button>
              </div>
            </div>
          </div>
        }
        actions={
          <>
            <SyncButton queryKeys={[[...linksKey], [...goalKey], [...rawKey]]} />
            <button className="btn btn-secondary" onClick={() => setShareOpen(true)}>
              <Share2 size={13} /> {tShare("shareCampaign")}
            </button>
            <button
              className="btn btn-secondary"
              onClick={copyAllLinks}
              disabled={links.length === 0}
            >
              {copiedAll ? <Check size={13} /> : <Copy size={13} />}
              {copiedAll ? tCommon("copied") : t("copyAllLinks")}
            </button>
            {/* Export this campaign — dropdown: per-link snapshot OR
                per-link daily long format. Both honor the test-click
                toggle so the CSV matches the on-screen numbers. */}
            <div style={{ position: "relative" }}>
              <button
                className="btn btn-secondary"
                onClick={() => setExportMenuOpen((v) => !v)}
                disabled={links.length === 0}
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
                      href={`/api/export/campaigns?format=links&campaign=${encodeURIComponent(
                        campaignName,
                      )}${includeInternal ? "&includeInternal=1" : ""}`}
                      className="export-menu-item"
                      onClick={() => setExportMenuOpen(false)}
                    >
                      <Table2 size={14} />
                      <span>
                        <strong>{t("exportLinks")}</strong>
                        <span className="export-menu-hint">{t("exportLinksHint")}</span>
                      </span>
                    </a>
                    <a
                      href={`/api/export/campaigns?format=link-daily&days=${Math.min(730, Math.ceil((Date.now() - rangeDates.start.getTime()) / 86_400_000))}&campaign=${encodeURIComponent(
                        campaignName,
                      )}${includeInternal ? "&includeInternal=1" : ""}`}
                      className="export-menu-item"
                      onClick={() => setExportMenuOpen(false)}
                    >
                      <CalendarRange size={14} />
                      <span>
                        <strong>{t("exportDaily")}</strong>
                        <span className="export-menu-hint">{t("exportDailyHint")}</span>
                      </span>
                    </a>
                  </div>
                </>
              )}
            </div>
            <Link
              href={`/links/new?utmCampaign=${encodeURIComponent(campaignName)}`}
              className="btn btn-primary"
            >
              <Plus size={13} /> {t("addLink")}
            </Link>
            {/* Reset clicks — non-destructive (soft reset via isInternal
                flag). Disabled when there are no links yet. Labeled so
                its purpose is discoverable without needing to hover
                for the tooltip. */}
            <button
              className="btn btn-secondary"
              onClick={() => setResetOpen(true)}
              disabled={links.length === 0 || totalClicks === 0}
              title={t("resetClicksTooltip")}
            >
              <RotateCcw size={13} />
              {t("resetClicksLabel")}
            </button>
            <button
              className="btn btn-ghost"
              onClick={toggleArchive}
              disabled={archiving || !record}
              title={phase === "archived" ? t("unarchiveTooltip") : t("archiveTooltip")}
            >
              {phase === "archived" ? <ArchiveRestore size={13} /> : <Archive size={13} />}
            </button>
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
            {phase !== "archived" && record && (
              <div className="mb-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between gap-3">
                <span>{t("deleteSuggestArchive")}</span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flexShrink: 0 }}
                  disabled={archiving || deleting}
                  onClick={async () => {
                    await toggleArchive();
                    setDeleteOpen(false);
                  }}
                >
                  <Archive size={13} /> {t("archiveInstead")}
                </button>
              </div>
            )}

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

      {/* Reset clicks dialog — soft reset; flags every real click as
          test data so KPI numbers drop to 0 without losing data. The
          green callout box at the bottom emphasises reversibility (the
          part that makes this differ from "Delete"). */}
      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !resetting && setResetOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl border border-slate-200 p-6 max-w-md w-full mx-4 z-10">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-amber-100">
              <RotateCcw className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              {t("resetDialogTitle", { name: campaignName })}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {t("resetDialogBody", { count: totalClicks, links: links.length })}
            </p>

            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 space-y-1.5">
              <div>✓ {t("resetReversibleNote")}</div>
              <div>✓ {t("resetDataPreservedNote")}</div>
              <div className="text-amber-800">⚠ {t("resetKpiDropNote")}</div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setResetOpen(false)}
                disabled={resetting}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {tCommon("cancel")}
              </button>
              <button
                onClick={() => handleResetClicks("reset")}
                disabled={resetting}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {resetting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                {t("resetConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "archived" && (
        <div className="campaign-notice">
          <Archive size={14} />
          <span>{t("archivedBanner")}</span>
          <button type="button" className="btn btn-secondary" onClick={toggleArchive} disabled={archiving}>
            <ArchiveRestore size={13} /> {t("unarchive")}
          </button>
        </div>
      )}

      {editingPeriod && (
        <div className="card card-padded" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ marginBottom: 4 }}>
            <CalendarDays size={14} style={{ color: "var(--ink-400)" }} />
            {t("periodTitle")}
          </div>
          <p className="muted" style={{ fontSize: 12, margin: "0 0 10px" }}>
            {t("periodHelp")}
          </p>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              {t("periodStart")}
              <input
                type="date"
                className="input"
                style={{ height: 32 }}
                value={startInput}
                max={endInput || undefined}
                onChange={(e) => setStartInput(e.target.value)}
              />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
              {t("periodEnd")}
              <input
                type="date"
                className="input"
                style={{ height: 32 }}
                value={endInput}
                min={startInput || undefined}
                onChange={(e) => setEndInput(e.target.value)}
              />
            </label>
            <button
              className="btn btn-primary"
              onClick={() => savePeriod(false)}
              disabled={periodSaving || (!startInput && !endInput) || Boolean(startInput && endInput && startInput > endInput)}
            >
              {periodSaving ? <Loader2 size={13} className="animate-spin" /> : tCommon("save")}
            </button>
            <button className="btn btn-secondary" onClick={() => setEditingPeriod(false)} disabled={periodSaving}>
              {tCommon("cancel")}
            </button>
            {periodSet && (
              <button className="btn btn-ghost" onClick={() => savePeriod(true)} disabled={periodSaving}>
                {t("periodClear")}
              </button>
            )}
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
          {!includeInternal && excludedSummary
            ? tAnalytics("filteredExcluded", { parts: excludedSummary })
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
          <div className="kpi-value">{rangeClicks !== null ? rangeClicks.toLocaleString() : "—"}</div>
          {/* Sub-line: "全時段 · 最近 7 天 N ↑X%" — the all-time number
              is the headline, the 7-day breakdown gives recency context
              so users don't have to bounce to /analytics for it. */}
          <div
            className="kpi-sub"
            style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
          >
            <span>{rangeLabel(trendRange)}</span>
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
            {rangeClicks === null
              ? "—"
              : links.length > 0
                ? Math.round(rangeClicks / links.length).toLocaleString()
                : "0"}
          </div>
          <div className="kpi-sub">{t("kpiPerLink")}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
      <div className="tabs" style={{ flex: 1 }}>
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
        {activeTab !== "links" && (
          <div className="segmented" style={{ marginBottom: 22, flexShrink: 0 }}>
            {((periodSet ? ["period", "all", "90d", "30d"] : ["all", "90d", "30d"]) as RangeId[]).map((r) => (
              <button
                key={r}
                className={trendRange === r ? "active" : ""}
                onClick={() => setRangeChoice(r)}
              >
                {rangeLabel(r)}
              </button>
            ))}
          </div>
        )}
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
                    {goalBaseClicks !== null ? goalBaseClicks.toLocaleString() : "—"} / {goalClicks.toLocaleString()}
                  </span>
                )}
                {goalClicks && (
                  <span className="muted" style={{ fontWeight: 400, fontSize: 11.5 }}>
                    · {periodSet ? t("goalBasisPeriod") : t("goalBasisAll")}
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
            ) : goalClicks && goalBaseClicks === null ? (
              <div className="goal-progress" />
            ) : goalClicks && goalBaseClicks !== null ? (
              (() => {
                const pct = (goalBaseClicks / goalClicks) * 100;
                const reached = goalBaseClicks >= goalClicks;
                return (
                  <>
                    <div className="goal-progress">
                      <div style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <div className="row-between" style={{ marginTop: 4 }}>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 500,
                          color: reached ? "var(--ok-fg)" : "var(--data-violet)",
                        }}
                      >
                        {reached
                          ? `${t("goalReached")} ${t("goalPct", { pct: Math.round(pct) })}`
                          : t("goalPct", { pct: pct < 10 ? pct.toFixed(1) : Math.round(pct) })}
                      </span>
                      {!reached && (
                        <span className="muted" style={{ fontSize: 11.5 }}>
                          {t("clicksRemaining", { n: (goalClicks - goalBaseClicks).toLocaleString() })}
                        </span>
                      )}
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
                {rangeLabel(trendRange)}
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
                {t("noClicksInRange")}
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
              {t("noClicksInRange")}
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
