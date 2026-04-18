"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import {
  ArrowLeft,
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
  X,
  LineChart as LineChartIcon,
  Users,
  Globe2,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { ClicksChart } from "@/components/analytics/ClicksChart";
import { PieChartComponent } from "@/components/analytics/PieChartComponent";
import { computeAnalytics, type RawAnalyticsData } from "@/lib/analytics/compute";

interface CampaignLink {
  id: string;
  code: string;
  originalUrl: string;
  title: string | null;
  status: string;
  createdAt: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmContent: string | null;
  _count: { clicks: number; conversions?: number };
}

type TabId = "overview" | "traffic" | "links";

/**
 * Campaign Detail page — the marketer's daily "mission control" for one
 * campaign. Three tabs:
 *   - Overview: KPI progress + summary stats + 30-day traffic trend
 *   - Traffic:  per-campaign breakdown of sources / mediums / devices /
 *               geography (mirrors Analytics page but pre-filtered)
 *   - Links:    every link under this campaign, sorted by clicks, with
 *               quick actions (copy / open / analytics)
 *
 * Design intent (see session notes): Route A in the Route A vs B
 * discussion — users live on this page for a given campaign, and the
 * global Analytics page is reserved for cross-campaign comparison.
 * That's why the per-campaign Traffic breakdown lives here, not there.
 */
export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { success } = useToast();
  const campaignName = decodeURIComponent(params.name as string);

  const [links, setLinks] = useState<CampaignLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  // KPI state
  const [goalClicks, setGoalClicks] = useState<number | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [goalSaving, setGoalSaving] = useState(false);

  // Raw analytics — used for Overview time-series + the entire Traffic tab.
  // Fetched once on mount because the endpoint is Redis-cached and both
  // tabs need it; paying once up front means switching tabs is instant.
  const [raw, setRaw] = useState<RawAnalyticsData | null>(null);
  const [rawLoading, setRawLoading] = useState(true);

  const shortBaseUrl = process.env.NEXT_PUBLIC_SHORT_URL || "http://localhost:3000/s";

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/links?campaign=${encodeURIComponent(campaignName)}&limit=100&sortBy=clicks&sortOrder=desc`,
      );
      const data = await response.json();
      setLinks(data.links || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [campaignName]);

  const fetchGoal = useCallback(async () => {
    try {
      const response = await fetch(`/api/utm-campaigns/${encodeURIComponent(campaignName)}`);
      if (response.ok) {
        const data = await response.json();
        setGoalClicks(data.goalClicks ?? null);
        setGoalInput(data.goalClicks ? String(data.goalClicks) : "");
      }
    } catch (e) {
      console.error(e);
    }
  }, [campaignName]);

  const fetchRaw = useCallback(async () => {
    setRawLoading(true);
    try {
      const response = await fetch("/api/analytics/raw");
      if (response.ok) {
        const data = await response.json();
        setRaw(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRawLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
    fetchGoal();
    fetchRaw();
  }, [fetchLinks, fetchGoal, fetchRaw]);

  // Compute breakdowns pre-filtered to this campaign. 30-day window
  // because the raw endpoint already caps at 90 and we want "recent" data.
  const computed = useMemo(() => {
    if (!raw) return null;
    const rangeEnd = new Date();
    const rangeStart = new Date();
    rangeStart.setDate(rangeEnd.getDate() - 30);
    return computeAnalytics(raw, { rangeStart, rangeEnd, campaign: campaignName });
  }, [raw, campaignName]);

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
        setGoalClicks(parsed);
        setEditingGoal(false);
        success("Goal saved!");
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
        setGoalClicks(null);
        setGoalInput("");
        setEditingGoal(false);
        success("Goal removed.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGoalSaving(false);
    }
  };

  const totalClicks = links.reduce((sum, l) => sum + l._count.clicks, 0);
  const totalConversions = links.reduce((sum, l) => sum + (l._count.conversions ?? 0), 0);
  const overallCvr = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
  const activeLinks = links.filter((l) => l.status === "ACTIVE").length;
  const maxClicks = links.length > 0 ? Math.max(...links.map((l) => l._count.clicks), 1) : 1;

  const copyLink = async (shortUrl: string, id: string) => {
    await navigator.clipboard.writeText(shortUrl);
    setCopiedId(id);
    success("Copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyAllLinks = async () => {
    const all = links.map((l) => `${shortBaseUrl}/${l.code}`).join("\n");
    await navigator.clipboard.writeText(all);
    setCopiedAll(true);
    success("All link URLs copied!");
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const statusDot: Record<string, string> = {
    ACTIVE: "bg-emerald-500",
    PAUSED: "bg-amber-500",
    ARCHIVED: "bg-slate-400",
  };

  const tabs: { id: TabId; label: string; icon: typeof LineChartIcon }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "traffic", label: "Traffic", icon: Users },
    { id: "links", label: "Links", icon: Link2 },
  ];

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <button
        onClick={() => router.push("/campaigns")}
        className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-medium">Back to Campaigns</span>
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 font-mono">{campaignName}</h1>
            <p className="text-sm text-slate-400 mt-0.5">UTM Campaign</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copyAllLinks}
            disabled={links.length === 0}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              copiedAll
                ? "bg-emerald-600 text-white"
                : "bg-[#03A9F4] hover:bg-[#0288D1] text-white"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {copiedAll ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedAll ? "Copied!" : "Copy All Links"}
          </button>
          <Link
            href={`/links/new?utmCampaign=${encodeURIComponent(campaignName)}`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Link
          </Link>
        </div>
      </div>

      {/* Summary stats — always visible across tabs so the headline numbers
          are never more than a glance away. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Links</span>
          </div>
          <p className="text-2xl font-semibold text-slate-900">{links.length}</p>
          <p className="text-xs text-emerald-600 mt-1">{activeLinks} active</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <MousePointerClick className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Clicks</span>
          </div>
          <p className="text-2xl font-semibold text-slate-900">{totalClicks.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">all-time</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Conversions</span>
          </div>
          <p className="text-2xl font-semibold text-slate-900">{totalConversions.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">
            {totalClicks > 0 ? `${overallCvr.toFixed(1)}% CVR` : "no data yet"}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Avg Clicks</span>
          </div>
          <p className="text-2xl font-semibold text-slate-900">
            {links.length > 0 ? Math.round(totalClicks / links.length).toLocaleString() : "0"}
          </p>
          <p className="text-xs text-slate-400 mt-1">per link</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  isActive
                    ? "border-[#03A9F4] text-[#03A9F4]"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ===== Overview Tab ===== */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* KPI Goal Tracking */}
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-semibold text-slate-900">Click Goal</span>
                {goalClicks && (
                  <span className="text-xs text-slate-400 tabular-nums">
                    {totalClicks.toLocaleString()} / {goalClicks.toLocaleString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {goalClicks && !editingGoal && (
                  <button
                    onClick={clearGoal}
                    className="p-1 text-slate-300 hover:text-slate-500 hover:bg-slate-100 rounded transition-colors"
                    title="Remove goal"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditingGoal(!editingGoal);
                    setGoalInput(goalClicks ? String(goalClicks) : "");
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                  title="Edit goal"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {editingGoal ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveGoal();
                    if (e.key === "Escape") setEditingGoal(false);
                  }}
                  placeholder="e.g. 10000"
                  className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-300 focus:border-violet-400"
                  autoFocus
                />
                <button
                  onClick={saveGoal}
                  disabled={!goalInput || goalSaving}
                  className="px-3 py-1.5 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
                >
                  {goalSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
                </button>
                <button
                  onClick={() => setEditingGoal(false)}
                  className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : goalClicks ? (
              <div className="space-y-1.5">
                {(() => {
                  const pct = Math.min((totalClicks / goalClicks) * 100, 100);
                  const reached = totalClicks >= goalClicks;
                  return (
                    <>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            reached ? "bg-emerald-500" : "bg-violet-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-medium ${
                            reached ? "text-emerald-600" : "text-violet-600"
                          }`}
                        >
                          {reached ? "🎉 Goal reached!" : `${pct.toFixed(1)}% of goal`}
                        </span>
                        <span className="text-xs text-slate-400">
                          {(goalClicks - totalClicks).toLocaleString()} clicks remaining
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <button
                onClick={() => setEditingGoal(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg hover:border-violet-300 hover:text-violet-500 transition-colors"
              >
                <Target className="w-4 h-4" />
                Set a click goal to track progress
              </button>
            )}
          </div>

          {/* 30-day click trend */}
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <div className="flex items-center gap-2 mb-4">
              <LineChartIcon className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-900">Clicks — last 30 days</span>
            </div>
            {rawLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : computed && computed.clicksByDay.length > 0 ? (
              <ClicksChart data={computed.clicksByDay} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-sm text-slate-400">
                No clicks recorded in the last 30 days
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Traffic Tab ===== */}
      {activeTab === "traffic" && (
        <div className="space-y-6">
          {rawLoading ? (
            <div className="bg-white rounded-xl border border-slate-100 p-12 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : !computed || computed.summary.totalClicks === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
              <p className="text-sm text-slate-400">
                No traffic data for this campaign in the last 30 days.
              </p>
            </div>
          ) : (
            <>
              {/* UTM source / medium breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TopList
                  title="Top sources"
                  rows={computed.utm.sources}
                  total={computed.summary.totalClicks}
                  colorClass="bg-cyan-50 text-cyan-700 border-cyan-100"
                />
                <TopList
                  title="Top mediums"
                  rows={computed.utm.mediums}
                  total={computed.summary.totalClicks}
                  colorClass="bg-violet-50 text-violet-700 border-violet-100"
                />
              </div>

              {/* Device / browser / OS pies */}
              <div className="bg-white rounded-xl border border-slate-100 p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Audience</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <PieChartComponent data={computed.devices} title="Device" />
                  <PieChartComponent data={computed.browsers} title="Browser" />
                  <PieChartComponent data={computed.operatingSystems} title="OS" />
                </div>
              </div>

              {/* Geography + referrers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TopList
                  title="Top countries"
                  rows={computed.countries.map((c) => ({ name: c.name, clicks: c.value }))}
                  total={computed.summary.totalClicks}
                  colorClass="bg-emerald-50 text-emerald-700 border-emerald-100"
                  icon={<Globe2 className="w-4 h-4 text-slate-400" />}
                />
                <TopList
                  title="Top referrers"
                  rows={computed.referrers.map((r) => ({ name: r.name, clicks: r.value }))}
                  total={computed.summary.totalClicks}
                  colorClass="bg-amber-50 text-amber-700 border-amber-100"
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== Links Tab ===== */}
      {activeTab === "links" && (
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Links in this campaign</h2>
            <span className="text-xs text-slate-400">{links.length} links · sorted by clicks</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : links.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-400 mb-3">No links found for this campaign</p>
              <Link
                href={`/links/new?utmCampaign=${encodeURIComponent(campaignName)}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#03A9F4] text-white text-sm font-medium rounded-lg hover:bg-[#0288D1] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create first link
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pl-4 py-2.5 pr-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Link
                    </th>
                    <th className="py-2.5 pr-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Source / Medium / Content
                    </th>
                    <th className="py-2.5 pr-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="py-2.5 pr-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Clicks
                    </th>
                    <th className="py-2.5 pr-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Conversions
                    </th>
                    <th className="py-2.5 pr-4 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((link) => {
                    const shortUrl = `${shortBaseUrl}/${link.code}`;
                    const clickPct = Math.max((link._count.clicks / maxClicks) * 100, 4);
                    const convs = link._count.conversions ?? 0;
                    const cvr = link._count.clicks > 0 ? (convs / link._count.clicks) * 100 : null;
                    return (
                      <tr
                        key={link.id}
                        className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="pl-4 py-3 pr-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-slate-900 truncate max-w-[200px]">
                                {link.title || `/${link.code}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <code className="text-xs text-[#03A9F4]">/{link.code}</code>
                              <button
                                onClick={() => copyLink(shortUrl, link.id)}
                                className="p-0.5 rounded hover:bg-slate-100 transition-colors"
                              >
                                {copiedId === link.id ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3 text-slate-400" />
                                )}
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex flex-wrap gap-1">
                            {link.utmSource && (
                              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-cyan-50 text-cyan-700 border border-cyan-100 rounded">
                                {link.utmSource}
                              </span>
                            )}
                            {link.utmMedium && (
                              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-violet-50 text-violet-700 border border-violet-100 rounded">
                                {link.utmMedium}
                              </span>
                            )}
                            {link.utmContent && (
                              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-100 rounded">
                                {link.utmContent}
                              </span>
                            )}
                            {!link.utmSource && !link.utmMedium && !link.utmContent && (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                statusDot[link.status] || "bg-slate-300"
                              }`}
                            />
                            {link.status}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-violet-400 rounded-full"
                                style={{ width: `${clickPct}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-slate-900 tabular-nums w-10 text-right">
                              {link._count.clicks.toLocaleString()}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-right">
                          {convs > 0 ? (
                            <div className="flex items-center justify-end gap-1 text-xs">
                              <span className="font-medium text-emerald-600 tabular-nums">
                                {convs.toLocaleString()}
                              </span>
                              {cvr !== null && (
                                <span className="text-slate-400 tabular-nums">
                                  · {cvr.toFixed(1)}%
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/analytics?linkId=${link.id}`}
                              className="text-xs text-[#03A9F4] hover:text-[#0288D1] font-medium"
                            >
                              Analytics →
                            </Link>
                            <a
                              href={shortUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
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
    </div>
  );
}

/**
 * Minimal top-N list with a bar showing each entry's share of total.
 * Inlined rather than split into its own component because the
 * styling is campaign-detail-specific (chip colour varies) and the
 * component is tiny.
 */
function TopList({
  title,
  rows,
  total,
  colorClass,
  icon,
}: {
  title: string;
  rows: { name: string; clicks: number }[];
  total: number;
  colorClass: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">No data</p>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 8).map((row) => {
            const pct = total > 0 ? (row.clicks / total) * 100 : 0;
            return (
              <div key={row.name} className="flex items-center gap-3">
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded border ${colorClass} truncate max-w-[140px]`}
                  title={row.name}
                >
                  {row.name || "—"}
                </span>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-400 rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-slate-700 tabular-nums w-10 text-right">
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
