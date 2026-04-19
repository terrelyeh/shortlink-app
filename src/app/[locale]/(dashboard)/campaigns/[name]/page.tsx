"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
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
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { ClicksChart } from "@/components/analytics/ClicksChart";
import { PieChartComponent } from "@/components/analytics/PieChartComponent";
import { computeAnalytics, type RawAnalyticsData } from "@/lib/analytics/compute";
import { PageHeader } from "@/components/layout/PageHeader";

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
  const campaignName = decodeURIComponent(params.name as string);

  const [links, setLinks] = useState<CampaignLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const [goalClicks, setGoalClicks] = useState<number | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [goalSaving, setGoalSaving] = useState(false);

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
        trendState: "up" | "down" | "flat" | "new" | "dead" | "none";
        sparkline: number[];
      }
    >();
    for (const [id, m] of acc) {
      let trendPct: number | null = null;
      let trendState: "up" | "down" | "flat" | "new" | "dead" | "none" = "none";
      if (m.prev7d === 0 && m.last7d === 0) {
        trendState = "none";
      } else if (m.prev7d === 0 && m.last7d > 0) {
        trendState = "new";
      } else if (m.prev7d > 0 && m.last7d === 0) {
        trendState = "dead";
        trendPct = -100;
      } else {
        trendPct = ((m.last7d - m.prev7d) / m.prev7d) * 100;
        trendState = trendPct > 2 ? "up" : trendPct < -2 ? "down" : "flat";
      }
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
  const activeLinks = links.filter((l) => l.status === "ACTIVE").length;
  const totalCampaignClicks = totalClicks || 1;

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

  const statusBadgeClass: Record<string, string> = {
    ACTIVE: "active",
    PAUSED: "paused",
    ARCHIVED: "archived",
  };

  return (
    <>
      <PageHeader
        back="Back to Campaigns"
        onBack={() => router.push("/campaigns")}
        title={
          <div className="campaign-hero" style={{ marginBottom: 0 }}>
            <div className="campaign-icon">
              <Megaphone size={20} />
            </div>
            <div>
              <div className="campaign-kind">UTM Campaign</div>
              <h1>{campaignName}</h1>
            </div>
          </div>
        }
        actions={
          <>
            <button
              className="btn btn-secondary"
              onClick={copyAllLinks}
              disabled={links.length === 0}
            >
              {copiedAll ? <Check size={13} /> : <Copy size={13} />}
              {copiedAll ? "Copied!" : "Copy all links"}
            </button>
            <Link
              href={`/links/new?utmCampaign=${encodeURIComponent(campaignName)}`}
              className="btn btn-primary"
            >
              <Plus size={13} /> Add link
            </Link>
          </>
        }
      />

      {/* KPI Row */}
      <div className="kpi-row" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="kpi">
          <div className="kpi-label">
            <Link2 size={12} /> Links
          </div>
          <div className="kpi-value">{links.length}</div>
          <div className="kpi-sub pos">● {activeLinks} active</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">
            <MousePointerClick size={12} /> Total clicks
          </div>
          <div className="kpi-value">{totalClicks.toLocaleString()}</div>
          <div className="kpi-sub">all-time</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">
            <BarChart3 size={12} /> Avg clicks
          </div>
          <div className="kpi-value">
            {links.length > 0 ? Math.round(totalClicks / links.length).toLocaleString() : "0"}
          </div>
          <div className="kpi-sub">per link</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={activeTab === "overview" ? "active" : ""}
          onClick={() => setActiveTab("overview")}
        >
          <LineChartIcon size={13} /> Overview
        </button>
        <button
          className={activeTab === "traffic" ? "active" : ""}
          onClick={() => setActiveTab("traffic")}
        >
          <Users size={13} /> Traffic
        </button>
        <button
          className={activeTab === "links" ? "active" : ""}
          onClick={() => setActiveTab("links")}
        >
          <Link2 size={13} /> Links
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
                Click Goal
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
                    title="Remove goal"
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
                  title="Edit goal"
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
                  placeholder="e.g. 10000"
                  className="input"
                  style={{ flex: 1, height: 32 }}
                  autoFocus
                />
                <button
                  className="btn btn-primary"
                  onClick={saveGoal}
                  disabled={!goalInput || goalSaving}
                >
                  {goalSaving ? <Loader2 size={13} className="animate-spin" /> : "Save"}
                </button>
                <button className="btn btn-secondary" onClick={() => setEditingGoal(false)}>
                  Cancel
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
                        {reached ? "🎉 Goal reached!" : `${pct.toFixed(1)}% of goal`}
                      </span>
                      <span className="muted" style={{ fontSize: 11.5 }}>
                        {(goalClicks - totalClicks).toLocaleString()} clicks remaining
                      </span>
                    </div>
                  </>
                );
              })()
            ) : (
              <p className="placeholder" style={{ margin: 0 }}>
                Set a click goal to track progress toward your target
              </p>
            )}
          </div>

          {/* Trend chart */}
          <div className="card card-padded">
            <div className="section-title" style={{ marginBottom: 10 }}>
              <LineChartIcon size={14} style={{ color: "var(--ink-400)" }} />
              Clicks
              <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
                last 30 days
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
                No clicks recorded in the last 30 days
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
              No traffic data for this campaign in the last 30 days.
            </div>
          ) : (
            <>
              <div className="grid-2">
                <TopList
                  title="Top sources"
                  subtitle="where the traffic is coming from"
                  rows={computed.utm.sources}
                  total={computed.summary.totalClicks}
                  pillClass="pill-source"
                />
                <TopList
                  title="Top mediums"
                  subtitle="paid, organic, email, etc."
                  rows={computed.utm.mediums}
                  total={computed.summary.totalClicks}
                  pillClass="pill-medium"
                />
              </div>

              <div className="card card-padded">
                <div className="section-title" style={{ marginBottom: 14 }}>Audience breakdown</div>
                <div className="grid-3">
                  <PieChartComponent data={computed.devices} title="Device" />
                  <PieChartComponent data={computed.browsers} title="Browser" />
                  <PieChartComponent data={computed.operatingSystems} title="OS" />
                </div>
              </div>

              <div className="grid-2">
                <TopList
                  title="Top countries"
                  rows={computed.countries.map((c) => ({ name: c.name, clicks: c.value }))}
                  total={computed.summary.totalClicks}
                  pillClass="pill-country"
                  icon={<Globe2 size={14} style={{ color: "var(--ink-400)" }} />}
                />
                <TopList
                  title="Top referrers"
                  rows={computed.referrers.map((r) => ({ name: r.name, clicks: r.value }))}
                  total={computed.summary.totalClicks}
                  pillClass="pill-content"
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
              Links in this campaign
              <span className="muted">· {links.length} links · sorted by clicks</span>
            </div>
            <Link
              href={`/links/new?utmCampaign=${encodeURIComponent(campaignName)}`}
              className="btn btn-secondary"
              style={{ height: 28, fontSize: 11.5 }}
            >
              <Plus size={12} /> Add link
            </Link>
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: "center" }}>
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--ink-500)" }} />
            </div>
          ) : links.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "var(--ink-500)", marginBottom: 12 }}>
                No links found for this campaign
              </p>
              <Link
                href={`/links/new?utmCampaign=${encodeURIComponent(campaignName)}`}
                className="btn btn-primary"
              >
                <Plus size={13} /> Create first link
              </Link>
            </div>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Link</th>
                  <th>Campaign / Source / Medium / Content</th>
                  <th style={{ width: 100 }}>Status</th>
                  <th className="num" style={{ width: 100 }}>
                    Clicks
                  </th>
                  <th className="num" style={{ width: 80 }} title="Distinct visitors (by hashed IP)">
                    Unique
                  </th>
                  <th className="num" style={{ width: 75 }} title="Share of this campaign's total clicks">
                    Share
                  </th>
                  <th style={{ width: 120 }} title="Daily clicks over the last 7 days">
                    7d trend
                  </th>
                  <th style={{ width: 110 }}>Last click</th>
                  <th style={{ width: 140 }}>Actions</th>
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
                            {formatRelativeTime(m.lastClickAt)}
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
                            Analytics <span style={{ fontSize: 10 }}>→</span>
                          </Link>
                          <Link
                            href={`/links/${link.id}`}
                            title="Edit link settings"
                            style={{ color: "var(--ink-500)", display: "inline-flex" }}
                          >
                            <Settings2 size={13} />
                          </Link>
                          <a
                            href={shortUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open short URL"
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
          )}
        </div>
      )}
    </>
  );
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return "just now";
  const min = Math.floor(s / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

function TrendCell({
  sparkline,
  trendPct,
  trendState,
}: {
  sparkline: number[];
  trendPct: number | null;
  trendState: "up" | "down" | "flat" | "new" | "dead" | "none";
}) {
  const w = 60;
  const h = 20;
  const max = Math.max(1, ...sparkline);
  const step = sparkline.length > 1 ? w / (sparkline.length - 1) : 0;
  const points = sparkline
    .map((v, i) => `${i * step},${h - (v / max) * h}`)
    .join(" ");

  const color =
    trendState === "up" || trendState === "new"
      ? "var(--data-emerald)"
      : trendState === "down" || trendState === "dead"
        ? "var(--err-fg)"
        : "var(--ink-400)";

  const Icon =
    trendState === "up" || trendState === "new"
      ? TrendingUp
      : trendState === "down" || trendState === "dead"
        ? TrendingDown
        : Minus;

  const label =
    trendState === "new"
      ? "NEW"
      : trendState === "dead"
        ? "—100%"
        : trendPct === null
          ? "—"
          : `${trendPct > 0 ? "+" : ""}${trendPct.toFixed(0)}%`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ display: "block", overflow: "visible" }}
        aria-hidden="true"
      >
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        title={trendPct !== null ? `${trendPct.toFixed(1)}% vs prev 7d` : "last 7d vs prev 7d"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 2,
          fontSize: 11,
          fontWeight: 600,
          color,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <Icon size={10} />
        {label}
      </span>
    </div>
  );
}

function TopList({
  title,
  subtitle,
  rows,
  total,
  pillClass,
  icon,
}: {
  title: string;
  subtitle?: string;
  rows: { name: string; clicks: number }[];
  total: number;
  pillClass: string;
  icon?: React.ReactNode;
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
          No data
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
