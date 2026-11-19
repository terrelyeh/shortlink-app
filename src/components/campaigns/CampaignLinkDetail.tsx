"use client";

/**
 * Expanded row in the campaign page's Links tab — one link's numbers
 * without leaving the campaign (it used to link out to /analytics).
 * Everything is computed from the raw payload the page already has.
 */

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ExternalLink, Filter } from "lucide-react";
import { ClicksChart } from "@/components/analytics/ClicksChart";
import { computeAnalytics, type RawAnalyticsData } from "@/lib/analytics/compute";

export function CampaignLinkDetail({
  raw,
  linkId,
  originalUrl,
  campaignName,
  onFilterTraffic,
}: {
  raw: RawAnalyticsData;
  linkId: string;
  originalUrl: string;
  campaignName: string;
  /** Jump to the Traffic tab filtered to this link. */
  onFilterTraffic: () => void;
}) {
  const t = useTranslations("campaigns.detail");
  const locale = useLocale();
  const [now] = useState(() => Date.now());

  const data = useMemo(
    () =>
      computeAnalytics(raw, {
        rangeStart: new Date(raw.meta.since),
        rangeEnd: new Date(now),
        campaign: campaignName,
        linkId,
      }),
    [raw, now, campaignName, linkId],
  );

  const { first, last, peak } = useMemo(() => {
    let first: number | null = null;
    let last: number | null = null;
    for (const c of raw.clicks) {
      if (c.shortLinkId !== linkId) continue;
      const ts = new Date(c.timestamp).getTime();
      if (first === null || ts < first) first = ts;
      if (last === null || ts > last) last = ts;
    }
    let peak: { date: string; clicks: number } | null = null;
    for (const d of data.clicksByDay) if (!peak || d.clicks > peak.clicks) peak = d;
    return { first, last, peak };
  }, [raw, linkId, data]);

  const fmt = (ms: number) =>
    new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(ms);
  const fmtDay = (day: string) => {
    const [y, m, d] = day.split("-").map(Number);
    return fmt(new Date(y, m - 1, d).getTime());
  };

  const total = data.summary.totalClicks;
  // The daily series runs to today; for a link that went quiet months ago
  // that's mostly a flat line, so stop a week after its last click.
  const chartDays = useMemo(() => {
    const d = data.clicksByDay;
    let lastNz = -1;
    for (let i = d.length - 1; i >= 0; i--) {
      if (d[i].clicks > 0) {
        lastNz = i;
        break;
      }
    }
    return lastNz < 0 ? d : d.slice(0, Math.min(d.length, lastNz + 8));
  }, [data]);

  return (
    <div className="link-detail">
      <div className="link-detail-dest">
        <span className="muted">{t("destination")}</span>
        <a href={originalUrl} target="_blank" rel="noopener noreferrer" title={originalUrl}>
          {originalUrl}
          <ExternalLink size={11} />
        </a>
      </div>

      {total === 0 ? (
        <p className="muted" style={{ fontSize: 13, margin: "8px 0 0" }}>
          {t("linkNoClicksYet")}
        </p>
      ) : (
        <>
          <div className="link-detail-stats">
            <Stat label={t("detailClicks")} value={total.toLocaleString()} />
            <Stat label={t("colUnique")} value={data.summary.uniqueVisitors.toLocaleString()} />
            <Stat label={t("detailFirstClick")} value={first ? fmt(first) : "—"} />
            <Stat label={t("colLastClick")} value={last ? fmt(last) : "—"} />
            <Stat
              label={t("detailPeakDay")}
              value={peak && peak.clicks > 0 ? `${fmtDay(peak.date)} · ${peak.clicks.toLocaleString()}` : "—"}
            />
          </div>

          <div className="link-detail-grid">
            <div className="link-detail-chart">
              <ClicksChart data={chartDays} height={180} />
            </div>
            <div className="link-detail-lists">
              <MiniList title={t("topCountries")} rows={data.countries.slice(0, 5)} total={total} />
              <MiniList
                title={t("referrerSites")}
                rows={[
                  ...data.referrers.slice(0, 4),
                  ...(data.noReferrer > 0 ? [{ name: t("noReferrer"), value: data.noReferrer }] : []),
                ]}
                total={total}
              />
              <MiniList title={t("device")} rows={data.devices.slice(0, 3)} total={total} />
            </div>
          </div>

          <button type="button" className="btn btn-secondary" style={{ marginTop: 10 }} onClick={onFilterTraffic}>
            <Filter size={12} /> {t("filterTrafficByLink")}
          </button>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="link-detail-stat-label">{label}</div>
      <div className="link-detail-stat-value">{value}</div>
    </div>
  );
}

function MiniList({
  title,
  rows,
  total,
}: {
  title: string;
  rows: { name: string; value: number }[];
  total: number;
}) {
  return (
    <div>
      <div className="link-detail-stat-label">{title}</div>
      {rows.length === 0 ? (
        <div className="muted" style={{ fontSize: 12 }}>—</div>
      ) : (
        rows.map((r) => (
          <div key={r.name} className="link-detail-minirow">
            <span title={r.name}>{r.name}</span>
            <span>
              {r.value.toLocaleString()}
              <span className="muted"> · {Math.round((r.value / Math.max(total, 1)) * 100)}%</span>
            </span>
          </div>
        ))
      )}
    </div>
  );
}
