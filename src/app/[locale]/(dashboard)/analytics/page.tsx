"use client";

import { useState, useEffect, useMemo } from "react";
import { computeAnalytics, type RawAnalyticsData } from "@/lib/analytics/compute";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ClicksChart } from "@/components/analytics/ClicksChart";
import { PieChartComponent } from "@/components/analytics/PieChartComponent";
import { ShareModal } from "@/components/analytics/ShareModal";
import {
  MousePointerClick,
  Users,
  TrendingUp,
  Loader2,
  Link2,
  ChevronDown,
  X,
  Target,
  Globe,
  Megaphone,
  Download,
  Share2,
  Tag as TagIcon,
  LineChart as LineChartIcon,
  BarChart3,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SyncButton } from "@/components/layout/SyncButton";
import { CampaignFilter } from "@/components/campaigns/CampaignFilter";

interface ShortLink {
  id: string;
  code: string;
  title: string | null;
  originalUrl: string;
}

interface TagOption {
  id: string;
  name: string;
  color: string | null;
  _count: { links: number };
}

const dateRanges = [
  { value: "24h", labelKey: "range24h" },
  { value: "7d", labelKey: "range7d" },
  { value: "30d", labelKey: "range30d" },
  { value: "90d", labelKey: "range90d" },
  { value: "custom", labelKey: "custom" },
];

export default function AnalyticsPage() {
  const t = useTranslations("analytics");
  const searchParams = useSearchParams();
  const [range, setRange] = useState("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState<string>(
    searchParams.get("campaign") || "",
  );
  const [selectedLinkId, setSelectedLinkId] = useState<string>(
    searchParams.get("linkId") || "",
  );
  const [selectedTagId, setSelectedTagId] = useState<string>("");
  const [shareOpen, setShareOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("performance");

  const tagsKey = useMemo(() => ["tags"] as const, []);
  const rawKey = useMemo(() => ["analytics-raw"] as const, []);

  const { data: tagsData } = useQuery({
    queryKey: tagsKey,
    queryFn: async () => {
      const response = await fetch("/api/tags");
      if (!response.ok) throw new Error("Failed to fetch tags");
      return ((await response.json()).tags || []) as TagOption[];
    },
  });
  const tags = useMemo(() => tagsData ?? [], [tagsData]);

  const {
    data: raw,
    isLoading: loading,
    error: rawError,
  } = useQuery<RawAnalyticsData>({
    queryKey: rawKey,
    queryFn: async () => {
      const response = await fetch("/api/analytics/raw");
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return (await response.json()) as RawAnalyticsData;
    },
  });
  const error = rawError ? (rawError as Error).message : null;

  const links: ShortLink[] = useMemo(
    () =>
      raw
        ? raw.links.map((l) => ({
            id: l.id,
            code: l.code,
            title: l.title,
            originalUrl: l.originalUrl,
          }))
        : [],
    [raw],
  );
  const loadingLinks = loading && !raw;

  const { rangeStart, rangeEnd } = useMemo(() => {
    const now = new Date();
    if (range === "custom" && customFrom) {
      return {
        rangeStart: new Date(customFrom),
        rangeEnd: customTo ? new Date(customTo) : now,
      };
    }
    const days = range === "24h" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 7;
    const start =
      range === "24h"
        ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
        : new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return { rangeStart: start, rangeEnd: now };
  }, [range, customFrom, customTo]);

  const data = useMemo(() => {
    if (!raw) return null;
    return computeAnalytics(raw, {
      rangeStart,
      rangeEnd,
      linkId: selectedLinkId || undefined,
      campaign: selectedCampaign || undefined,
      tagId: selectedTagId || undefined,
    });
  }, [raw, rangeStart, rangeEnd, selectedLinkId, selectedCampaign, selectedTagId]);

  const handleCampaignChange = (value: string) => {
    setSelectedCampaign(value);
    setSelectedLinkId("");
  };

  const selectedLink = links.find((l) => l.id === selectedLinkId);

  const sections = [
    { key: "performance", label: t("sections.campaigns"), icon: LineChartIcon },
    { key: "overview", label: t("sections.overview"), icon: BarChart3 },
    { key: "traffic", label: t("sections.traffic"), icon: Globe },
    { key: "audience", label: t("sections.audience"), icon: Users },
  ];

  useEffect(() => {
    const scroller = document.querySelector(".analytics-scroll");
    if (!scroller) return;
    const handler = () => {
      for (const s of sections) {
        const el = document.getElementById(`a-${s.key}`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top <= 80 && r.bottom > 80) {
          setActiveSection(s.key);
          break;
        }
      }
    };
    scroller.addEventListener("scroll", handler);
    return () => scroller.removeEventListener("scroll", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const jumpTo = (key: string) => {
    setActiveSection(key);
    const el = document.getElementById(`a-${key}`);
    const scroller = document.querySelector(".analytics-scroll");
    if (el && scroller) {
      scroller.scrollTo({ top: (el as HTMLElement).offsetTop - 12, behavior: "smooth" });
    }
  };

  if (error) {
    return (
      <div className="card card-padded" style={{ borderColor: "#FCA5B0", background: "#FEF7F8", color: "var(--err-fg)" }}>
        {error}
      </div>
    );
  }

  return (
    <>
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        linkId={selectedLinkId || undefined}
        campaignFilter={selectedCampaign || undefined}
        dateRange={range}
      />

      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <SyncButton queryKeys={[[...rawKey], [...tagsKey]]} />
            <button className="btn btn-secondary" onClick={() => setShareOpen(true)}>
              <Share2 size={12} /> Share report
            </button>
            <a
              href={`/api/export/analytics?range=${range}${selectedCampaign ? `&campaign=${selectedCampaign}` : ""}${selectedLinkId ? `&linkId=${selectedLinkId}` : ""}`}
              className="btn btn-secondary"
            >
              <Download size={12} /> Export CSV
            </a>
          </>
        }
      />

      {/* Toolbar */}
      <div className="toolbar">
        <div className="segmented">
          {dateRanges.map((r) => (
            <button
              key={r.value}
              className={range === r.value ? "active" : ""}
              onClick={() => setRange(r.value)}
            >
              {t(r.labelKey)}
            </button>
          ))}
        </div>

        {range === "custom" && (
          <div className="row" style={{ gap: 8 }}>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="input"
              style={{ height: 32, width: 160 }}
            />
            <span className="muted">–</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="input"
              style={{ height: 32, width: 160 }}
            />
          </div>
        )}

        <div style={{ flex: 1 }} />

        <CampaignFilter value={selectedCampaign} onChange={handleCampaignChange} showNoCampaign />

        {tags.length > 0 && (
          <div style={{ position: "relative" }}>
            <select
              value={selectedTagId}
              onChange={(e) => {
                setSelectedTagId(e.target.value);
                setSelectedLinkId("");
              }}
              className={`input ${selectedTagId ? "filter-active" : ""}`}
              style={{ height: 32, paddingLeft: 32, paddingRight: 28, appearance: "none", cursor: "pointer" }}
            >
              <option value="">All Tags</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  #{tag.name} ({tag._count.links})
                </option>
              ))}
            </select>
            <TagIcon
              size={13}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: selectedTagId ? "var(--brand-700)" : "var(--ink-500)",
                pointerEvents: "none",
              }}
            />
            <ChevronDown
              size={12}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                color: selectedTagId ? "var(--brand-700)" : "var(--ink-500)",
                pointerEvents: "none",
              }}
            />
          </div>
        )}

        <div style={{ position: "relative", minWidth: 180 }}>
          <select
            value={selectedLinkId}
            onChange={(e) => setSelectedLinkId(e.target.value)}
            disabled={loadingLinks}
            className={`input ${selectedLinkId ? "filter-active" : ""}`}
            style={{ height: 32, paddingLeft: 32, paddingRight: 28, appearance: "none", cursor: "pointer", width: "100%" }}
          >
            <option value="">{t("allLinks")}</option>
            {links.map((link) => (
              <option key={link.id} value={link.id}>
                /{link.code} {link.title ? `- ${link.title}` : ""}
              </option>
            ))}
          </select>
          <Link2
            size={13}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: selectedLinkId ? "var(--brand-700)" : "var(--ink-500)",
              pointerEvents: "none",
            }}
          />
          {loadingLinks ? (
            <Loader2
              size={12}
              className="animate-spin"
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--ink-500)",
                pointerEvents: "none",
              }}
            />
          ) : (
            <ChevronDown
              size={12}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--ink-500)",
                pointerEvents: "none",
              }}
            />
          )}
        </div>

        {(selectedLinkId || selectedTagId) && (
          <button
            className="btn btn-ghost"
            onClick={() => {
              setSelectedLinkId("");
              setSelectedTagId("");
            }}
            title={t("clearFilter")}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Selected link callout — promoted to a clearly-noticed filter
          banner so the user always knows analytics are scoped to one
          link, not all-workspace traffic. */}
      {selectedLink && (
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 14,
            background: "var(--brand-50)",
            border: "1px solid var(--brand-100)",
            borderLeft: "4px solid var(--brand-500)",
            borderRadius: 10,
            padding: "14px 18px",
            marginBottom: 18,
            boxShadow: "0 1px 2px rgba(3, 169, 244, 0.08)",
          }}
        >
          <div
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "var(--brand-100)",
              color: "var(--brand-700)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              alignSelf: "flex-start",
              marginTop: 2,
            }}
          >
            <Link2 size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: "var(--brand-700)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 4,
              }}
            >
              {t("viewingLinkAnalytics")}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                flexWrap: "wrap",
                rowGap: 2,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--ink-100)",
                }}
              >
                /{selectedLink.code}
              </span>
              {selectedLink.title && (
                <span style={{ fontSize: 14, color: "var(--ink-300)" }}>
                  — {selectedLink.title}
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--ink-500)",
                marginTop: 4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={selectedLink.originalUrl}
            >
              → {selectedLink.originalUrl}
            </div>
          </div>
          <button
            className="btn btn-ghost"
            style={{ padding: "6px 10px", height: 32, alignSelf: "flex-start" }}
            onClick={() => setSelectedLinkId("")}
            title={t("clearFilter")}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Selected campaign callout — same banner pattern as the link
          one, only shown when no specific link is also selected (the
          link banner is more specific and would dominate). Uses violet
          accents to visually distinguish from the link banner's sky. */}
      {selectedCampaign && !selectedLink && data && (
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 14,
            background: "var(--violet-50, #F5F3FF)",
            border: "1px solid #E9D5FF",
            borderLeft: "4px solid #7C3AED",
            borderRadius: 10,
            padding: "14px 18px",
            marginBottom: 18,
            boxShadow: "0 1px 2px rgba(124, 58, 237, 0.08)",
          }}
        >
          <div
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "#E9D5FF",
              color: "#5B21B6",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              alignSelf: "flex-start",
              marginTop: 2,
            }}
          >
            <Megaphone size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: "#5B21B6",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 4,
              }}
            >
              {t("viewingCampaignAnalytics")}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                flexWrap: "wrap",
                rowGap: 2,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--ink-100)",
                }}
              >
                {selectedCampaign}
              </span>
              <span style={{ fontSize: 13, color: "var(--ink-400)" }}>
                {t("inWindowClicks", { n: data.summary.totalClicks })}
              </span>
            </div>
          </div>
          <a
            href={`/campaigns/${encodeURIComponent(selectedCampaign)}`}
            className="btn btn-ghost"
            style={{
              padding: "6px 12px",
              height: 32,
              alignSelf: "flex-start",
              fontSize: 12.5,
              color: "#5B21B6",
            }}
            title={t("openCampaignDetail")}
          >
            {t("openCampaignDetail")} →
          </a>
          <button
            className="btn btn-ghost"
            style={{ padding: "6px 10px", height: 32, alignSelf: "flex-start" }}
            onClick={() => setSelectedCampaign("")}
            title={t("clearFilter")}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main grid with anchor rail */}
      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 20, alignItems: "start" }}>
        <div className="anchor-rail">
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "var(--ink-500)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              padding: "4px 10px 8px",
            }}
          >
            On this page
          </div>
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                className={activeSection === s.key ? "active" : ""}
                onClick={() => jumpTo(s.key)}
              >
                <span className="dot" />
                <Icon size={13} />
                {s.label}
              </button>
            );
          })}
        </div>

        <div
          className="analytics-scroll"
          style={{ maxHeight: "calc(100vh - 160px)", overflowY: "auto", paddingRight: 4 }}
        >
          {loading && !data ? (
            <div style={{ padding: 64, textAlign: "center" }}>
              <Loader2 size={24} className="animate-spin" style={{ color: "var(--ink-500)" }} />
            </div>
          ) : data ? (
            <>
              {/* Campaign Performance */}
              <section id="a-performance" className="a-section">
                <div className="a-section-head">
                  <h2>{t("sections.campaigns")}</h2>
                  <span className="hint">by campaign, source and medium</span>
                </div>

                {!data.utm ||
                (data.utm.campaigns.length === 0 && data.utm.sources.length === 0) ? (
                  <div className="card card-padded" style={{ textAlign: "center", padding: 32 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: "var(--warn-bg)",
                        color: "var(--warn-fg)",
                        display: "grid",
                        placeItems: "center",
                        margin: "0 auto 12px",
                      }}
                    >
                      <Target size={20} />
                    </div>
                    <h3 className="section-title" style={{ justifyContent: "center" }}>
                      {t("utm.emptyState.title")}
                    </h3>
                    <p className="section-sub" style={{ maxWidth: 420, margin: "6px auto 16px" }}>
                      {t("utm.emptyState.description")}
                    </p>
                    <div className="row" style={{ justifyContent: "center" }}>
                      <a href="/links/new" className="btn btn-primary">
                        {t("utm.emptyState.createLink")}
                      </a>
                      <a href="/campaigns" className="btn btn-secondary">
                        <Megaphone size={12} /> {t("utm.emptyState.manageCampaigns")}
                      </a>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid-3" style={{ marginBottom: 12 }}>
                      <PerfTile
                        label={t("utm.byCampaign")}
                        rows={data.utm.campaigns}
                        color="var(--data-amber)"
                      />
                      <PerfTile
                        label={t("utm.bySource")}
                        rows={data.utm.sources}
                        color="var(--data-cyan)"
                      />
                      <PerfTile
                        label={t("utm.byMedium")}
                        rows={data.utm.mediums}
                        color="var(--data-emerald)"
                      />
                    </div>

                    {data.utm.campaignSource.length > 0 && (
                      <div className="card" style={{ marginBottom: 12 }}>
                        <div className="tbl-head" style={{ padding: "12px 16px" }}>
                          <div className="tbl-head-title">{t("utm.campaignSource")}</div>
                        </div>
                        <div className="table-scroll">
                        <table className="data">
                          <thead>
                            <tr>
                              <th>{t("utm.campaign")}</th>
                              <th>{t("utm.source")}</th>
                              <th className="num" style={{ width: 80 }}>
                                {t("clicks")}
                              </th>
                              <th className="num" style={{ width: 180 }}>
                                {t("utm.performance")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.utm.campaignSource.map((item, i) => {
                              const max = data.utm.campaignSource[0]?.clicks || 1;
                              const pct = (item.clicks / max) * 100;
                              return (
                                <tr key={i}>
                                  <td>
                                    <span className="pill pill-campaign">{item.campaign}</span>
                                  </td>
                                  <td>
                                    <span className="pill pill-source">{item.source}</span>
                                  </td>
                                  <td className="num">{item.clicks.toLocaleString()}</td>
                                  <td className="num">
                                    <div className="bar-cell">
                                      <div className="bar-track">
                                        <div
                                          className="bar-fill"
                                          style={{ width: `${pct}%`, background: "var(--data-violet)" }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    )}

                    {data.utm.campaignContent.length > 0 && (
                      <div className="card">
                        <div className="tbl-head" style={{ padding: "12px 16px" }}>
                          <div className="tbl-head-title">{t("utm.campaignContent")}</div>
                          <span className="muted" style={{ fontSize: 11.5 }}>
                            {t("utm.campaignContentDesc")}
                          </span>
                        </div>
                        <div className="table-scroll">
                        <table className="data">
                          <thead>
                            <tr>
                              <th>{t("utm.campaign")}</th>
                              <th>{t("utm.content")}</th>
                              <th className="num" style={{ width: 80 }}>
                                {t("clicks")}
                              </th>
                              <th className="num" style={{ width: 180 }}>
                                {t("utm.performance")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.utm.campaignContent.map((item, i) => {
                              const max = data.utm.campaignContent[0]?.clicks || 1;
                              const pct = (item.clicks / max) * 100;
                              return (
                                <tr key={i}>
                                  <td>
                                    <span className="pill pill-campaign">{item.campaign}</span>
                                  </td>
                                  <td>
                                    <span className="pill pill-content">{item.content}</span>
                                  </td>
                                  <td className="num">{item.clicks.toLocaleString()}</td>
                                  <td className="num">
                                    <div className="bar-cell">
                                      <div className="bar-track">
                                        <div
                                          className="bar-fill"
                                          style={{ width: `${pct}%`, background: "var(--data-rose)" }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>

              {/* Overview */}
              <section id="a-overview" className="a-section">
                <div className="a-section-head">
                  <h2>{t("sections.overview")}</h2>
                  <span className="hint">click volume and uniques</span>
                </div>
                <div className="grid-3" style={{ marginBottom: 12 }}>
                  <div className="kpi">
                    <div className="kpi-label">
                      <MousePointerClick size={12} /> {t("clicks")}
                    </div>
                    <div className="kpi-value">{data.summary.totalClicks.toLocaleString()}</div>
                    {data.summary.clicksChange !== 0 && (
                      <div
                        className={`kpi-sub ${data.summary.clicksChange > 0 ? "pos" : "neg"}`}
                      >
                        {data.summary.clicksChange > 0 ? "▲" : "▼"}{" "}
                        {Math.abs(data.summary.clicksChange)}% {t("vsPreviousPeriod")}
                      </div>
                    )}
                  </div>
                  <div className="kpi">
                    <div className="kpi-label">
                      <Users size={12} /> {t("uniqueClicks")}
                    </div>
                    <div className="kpi-value">{data.summary.uniqueVisitors.toLocaleString()}</div>
                    {data.summary.totalClicks > 0 && (
                      <div className="kpi-sub">
                        {t("ofTotalClicks", {
                          pct: (
                            (data.summary.uniqueVisitors /
                              data.summary.totalClicks) *
                            100
                          ).toFixed(1),
                        })}
                      </div>
                    )}
                  </div>
                  <div className="kpi">
                    <div className="kpi-label">
                      <TrendingUp size={12} /> {t("uniqueRate")}
                    </div>
                    <div className="kpi-value">
                      {data.summary.totalClicks > 0
                        ? `${((data.summary.uniqueVisitors / data.summary.totalClicks) * 100).toFixed(1)}%`
                        : "0%"}
                    </div>
                  </div>
                </div>
                <div className="card card-padded">
                  <div className="section-title" style={{ marginBottom: 10 }}>
                    <LineChartIcon size={14} style={{ color: "var(--ink-400)" }} />
                    {t("clicksOverTime")}
                  </div>
                  {data.clicksByDay.length > 0 ? (
                    <ClicksChart data={data.clicksByDay} />
                  ) : (
                    <div
                      style={{
                        height: 300,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 13,
                        color: "var(--ink-500)",
                      }}
                    >
                      {t("noData")}
                    </div>
                  )}
                </div>
              </section>

              {/* Traffic Sources */}
              <section id="a-traffic" className="a-section">
                <div className="a-section-head">
                  <h2>{t("sections.traffic")}</h2>
                  <span className="hint">countries, top links, referrers</span>
                </div>
                {/* Country first — always populated, the most reliable
                    geographic signal. Made full-width so longer country
                    names (e.g. "United States") aren't truncated. */}
                <div className="card card-padded" style={{ marginBottom: 12 }}>
                  <div className="section-title">{t("countries")}</div>
                  <p className="section-sub">&nbsp;</p>
                  {data.countries.length > 0 ? (
                    <ProgressList rows={data.countries} color="var(--data-violet)" pillClass="pill-country" />
                  ) : (
                    <div style={{ padding: "24px 0", textAlign: "center" }}>
                      <div className="placeholder">{t("noData")}</div>
                    </div>
                  )}
                </div>

                {!selectedLinkId && data.topLinks.length > 0 && (
                  <div className="tbl-wrap">
                    <div className="tbl-head">
                      <div className="tbl-head-title">{t("topPerformingLinks")}</div>
                    </div>
                    <div className="table-scroll">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>{t("shortUrl")}</th>
                          <th>{t("linkTitle")}</th>
                          <th className="num" style={{ width: 80 }}>
                            {t("clicks")}
                          </th>
                          <th style={{ width: 120 }}>{t("action")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topLinks.map((link) => (
                          <tr key={link.id}>
                            <td>
                              <span
                                style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: 12.5,
                                  color: "var(--brand-600)",
                                }}
                              >
                                /{link.code}
                              </span>
                            </td>
                            <td
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: 12,
                                maxWidth: 300,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {link.title || link.originalUrl}
                            </td>
                            <td className="num">{link.clicks.toLocaleString()}</td>
                            <td>
                              <button
                                onClick={() => setSelectedLinkId(link.id)}
                                style={{
                                  color: "var(--brand-600)",
                                  fontSize: 12,
                                  fontWeight: 500,
                                  background: "none",
                                  border: 0,
                                  cursor: "pointer",
                                }}
                              >
                                {t("viewDetails")} →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}

                {/* Referrer — bottom of section, secondary signal.
                    Mostly empty for EDM / chat / direct traffic; useful
                    for spotting natural pickups (blog mentions, partner
                    sites, leaks). See referrersHint copy. */}
                <div className="card card-padded" style={{ marginTop: 12 }}>
                  <div className="section-title">{t("referrers")}</div>
                  <p className="section-sub" style={{ lineHeight: 1.55 }}>
                    {t("referrersHint")}
                  </p>
                  {data.referrers.length > 0 ? (
                    <ProgressList rows={data.referrers} color="var(--data-cyan)" />
                  ) : (
                    <div style={{ padding: "24px 0", textAlign: "center" }}>
                      <div className="placeholder">{t("noData")}</div>
                    </div>
                  )}
                </div>
              </section>

              {/* Audience */}
              <section id="a-audience" className="a-section">
                <div className="a-section-head">
                  <h2>{t("sections.audience")}</h2>
                  <span className="hint">device, browser, OS</span>
                </div>
                <div className="card card-padded">
                  <div className="grid-3">
                    <PieChartComponent data={data.devices} title={t("devices")} />
                    <PieChartComponent data={data.browsers} title={t("browsers")} />
                    <PieChartComponent
                      data={data.operatingSystems}
                      title={t("operatingSystems")}
                    />
                  </div>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>

      {raw?.meta.truncated && (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 40,
            background: "var(--warn-bg)",
            border: "1px solid #FCD5B5",
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 12,
            color: "var(--warn-fg)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          ⚠️ 只顯示最近 10,000 筆點擊。更早的資料請縮小日期範圍或選特定連結。
        </div>
      )}
    </>
  );
}

function PerfTile({
  label,
  rows,
  color,
}: {
  label: string;
  rows: { name: string; clicks: number }[];
  color: string;
}) {
  const top = rows[0];
  return (
    <div className="kpi" style={{ padding: "12px 14px" }}>
      <div className="kpi-label" style={{ marginBottom: 6 }}>
        {label}
      </div>
      {top ? (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: "var(--ink-100)",
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 140,
              }}
              title={top.name}
            >
              {top.name}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 16,
                fontWeight: 600,
                color: "var(--ink-100)",
              }}
            >
              {top.clicks.toLocaleString()}
            </span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: "100%", background: color }} />
          </div>
        </>
      ) : (
        <p className="placeholder" style={{ margin: 0 }}>
          No data
        </p>
      )}
    </div>
  );
}

function ProgressList({
  rows,
  color,
  pillClass,
}: {
  rows: { name: string; value: number }[];
  color: string;
  pillClass?: string;
}) {
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  const max = rows[0]?.value || 1;
  return (
    <div className="stack" style={{ gap: 10 }}>
      {rows.map((row, i) => (
        <div key={i}>
          <div className="row-between" style={{ marginBottom: 4 }}>
            {pillClass ? (
              <span className={`pill ${pillClass}`} title={row.name}>
                {row.name}
              </span>
            ) : (
              <span style={{ fontSize: 13, color: "var(--ink-300)" }}>{row.name}</span>
            )}
            <div className="row" style={{ gap: 8 }}>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--ink-500)",
                }}
              >
                {((row.value / total) * 100).toFixed(0)}%
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12.5,
                  color: "var(--ink-200)",
                }}
              >
                {row.value.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${(row.value / max) * 100}%`, background: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
