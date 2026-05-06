/**
 * Client-side analytics aggregation.
 *
 * Mirrors the computation in /api/analytics/route.ts but operates on raw
 * click rows + link metadata delivered once by /api/analytics/raw. Runs in
 * the browser via useMemo so filter switches are zero-latency.
 *
 * Scale envelope (Free tier):
 *   - up to 10,000 clicks × ~200 bytes = ~2 MB payload — fine
 *   - past that we truncate and show a banner
 */

export interface RawClick {
  shortLinkId: string;
  timestamp: string; // ISO
  device: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  city: string | null;
  ipHash: string | null;
  referrer: string | null;
}

export interface LinkMeta {
  id: string;
  code: string;
  title: string | null;
  originalUrl: string;
  utmCampaign: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmContent: string | null;
  tagIds: string[];
}

export interface RawAnalyticsData {
  clicks: RawClick[];
  links: LinkMeta[];
  meta: {
    totalClicks: number;
    /** True when the backend had to cut at the cap */
    truncated: boolean;
    /** ISO date; clicks older than this are NOT in `clicks` */
    since: string;
    /** True when test/internal clicks are mixed into the payload */
    includeInternal?: boolean;
    /** Count of clicks excluded by the test-click filter (0 when off) */
    excludedInternal?: number;
  };
}

export interface ComputedAnalytics {
  summary: {
    totalClicks: number;
    uniqueVisitors: number;
    clicksChange: number;
  };
  clicksByDay: { date: string; clicks: number }[];
  clicksByHour: { hour: number; clicks: number }[];
  devices: { name: string; value: number }[];
  browsers: { name: string; value: number }[];
  operatingSystems: { name: string; value: number }[];
  referrers: { name: string; value: number }[];
  countries: { name: string; value: number }[];
  cities: { name: string; country: string | null; value: number }[];
  /** Hour-by-hour curve from the first click in the window. Useful to
   *  see how fast a campaign decays — typical EDM has 60% in first 24h. */
  decay: {
    hourFromFirst: number;
    clicks: number;
    cumClicks: number;
  }[];
  /** 7×24 grid of click counts. heatmap[dayOfWeek][hour]. dayOfWeek
   *  follows JS Date convention: 0 = Sunday, 6 = Saturday. */
  dayHourHeatmap: number[][];
  topLinks: {
    id: string;
    code: string;
    title: string | null;
    originalUrl: string;
    clicks: number;
  }[];
  utm: {
    campaigns: { name: string; clicks: number }[];
    sources: { name: string; clicks: number }[];
    mediums: { name: string; clicks: number }[];
    campaignSource: { campaign: string; source: string; clicks: number }[];
    campaignContent: { campaign: string; content: string; clicks: number }[];
  };
}

export interface ComputeFilters {
  /** inclusive */
  rangeStart: Date;
  /** inclusive */
  rangeEnd: Date;
  /** Specific link ID (short_links.id) */
  linkId?: string;
  /**
   * utm_campaign filter. `null` = no filter.
   * `"__none__"` = only clicks on links WITHOUT a campaign set.
   * Any other string = exact match.
   */
  campaign?: string | null;
  /** Filter to links that carry this tag */
  tagId?: string;
}

function sortAndSlice(map: Map<string, number>, limit = 10) {
  return Array.from(map.entries())
    .map(([name, clicks]) => ({ name, clicks }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, limit);
}

function sortByClicksDesc<T extends { clicks: number }>(arr: T[], limit: number) {
  return [...arr].sort((a, b) => b.clicks - a.clicks).slice(0, limit);
}

export function computeAnalytics(
  raw: RawAnalyticsData,
  filters: ComputeFilters,
): ComputedAnalytics {
  const { rangeStart, rangeEnd, linkId, campaign, tagId } = filters;

  // --- 1. Determine the set of link IDs this view cares about ---
  const linksById = new Map<string, LinkMeta>();
  for (const l of raw.links) linksById.set(l.id, l);

  let eligibleLinkIds: Set<string>;
  if (linkId) {
    eligibleLinkIds = new Set([linkId]);
  } else {
    eligibleLinkIds = new Set();
    for (const l of raw.links) {
      if (campaign !== null && campaign !== undefined) {
        if (campaign === "__none__") {
          if (l.utmCampaign) continue;
        } else if (l.utmCampaign !== campaign) {
          continue;
        }
      }
      if (tagId && !l.tagIds.includes(tagId)) continue;
      eligibleLinkIds.add(l.id);
    }
  }

  // --- 2. Filter clicks to current range & eligible links ---
  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();
  const periodMs = endMs - startMs;
  const prevStartMs = startMs - periodMs;

  const inRange: RawClick[] = [];
  let prevPeriodCount = 0;

  for (const c of raw.clicks) {
    if (!eligibleLinkIds.has(c.shortLinkId)) continue;
    const t = new Date(c.timestamp).getTime();
    if (t >= startMs && t <= endMs) {
      inRange.push(c);
    } else if (t >= prevStartMs && t < startMs) {
      prevPeriodCount += 1;
    }
  }

  // --- 3. Summary ---
  const totalClicks = inRange.length;
  const uniqueIps = new Set<string>();
  for (const c of inRange) if (c.ipHash) uniqueIps.add(c.ipHash);
  const uniqueVisitors = uniqueIps.size;
  let clicksChange = 0;
  if (prevPeriodCount > 0) {
    clicksChange = Math.round(
      ((totalClicks - prevPeriodCount) / prevPeriodCount) * 100,
    );
  } else if (totalClicks > 0) {
    clicksChange = 100;
  }

  // --- 4. By day / by hour ---
  const dayMap = new Map<string, number>();
  const hourMap = new Map<number, number>();
  for (let h = 0; h < 24; h++) hourMap.set(h, 0);

  for (const c of inRange) {
    const d = new Date(c.timestamp);
    const dayKey = d.toISOString().slice(0, 10);
    dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + 1);
    hourMap.set(d.getHours(), (hourMap.get(d.getHours()) || 0) + 1);
  }

  const clicksByDay = Array.from(dayMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, clicks]) => ({ date, clicks }));

  const clicksByHour = Array.from(hourMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, clicks]) => ({ hour, clicks }));

  // --- 5. Dimensions: devices / browsers / os / referrer / country / city ---
  const deviceMap = new Map<string, number>();
  const browserMap = new Map<string, number>();
  const osMap = new Map<string, number>();
  const referrerMap = new Map<string, number>();
  const countryMap = new Map<string, number>();
  // Key by "country|city" so two cities with the same name in
  // different countries don't collapse together.
  const cityMap = new Map<string, { country: string | null; count: number }>();

  // 7×24 click heatmap (dayOfWeek × hour). Built in the same loop as
  // the per-click dimensional aggregation to keep one pass over data.
  const dayHourHeatmap: number[][] = Array.from({ length: 7 }, () =>
    new Array(24).fill(0),
  );

  for (const c of inRange) {
    const dev = c.device || "Unknown";
    deviceMap.set(dev, (deviceMap.get(dev) || 0) + 1);
    const br = c.browser || "Unknown";
    browserMap.set(br, (browserMap.get(br) || 0) + 1);
    const osn = c.os || "Unknown";
    osMap.set(osn, (osMap.get(osn) || 0) + 1);
    if (c.referrer) {
      referrerMap.set(c.referrer, (referrerMap.get(c.referrer) || 0) + 1);
    }
    if (c.country) {
      countryMap.set(c.country, (countryMap.get(c.country) || 0) + 1);
    }
    if (c.city) {
      const key = `${c.country ?? ""}|${c.city}`;
      const prev = cityMap.get(key);
      if (prev) {
        prev.count += 1;
      } else {
        cityMap.set(key, { country: c.country, count: 1 });
      }
    }
    const t = new Date(c.timestamp);
    dayHourHeatmap[t.getDay()][t.getHours()] += 1;
  }

  const toNameValue = (m: Map<string, number>) =>
    Array.from(m.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

  const cities = Array.from(cityMap.entries())
    .map(([key, v]) => ({
      name: key.split("|", 2)[1],
      country: v.country,
      value: v.count,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  // --- 5b. Decay curve from first click ---
  // For each click, bucket by hours-since-first-click. Tail beyond
  // 72h is collapsed into the "72+" bucket so the chart stays readable
  // — most marketing campaigns peak inside that window anyway.
  const DECAY_HORIZON_HOURS = 72;
  const decay: { hourFromFirst: number; clicks: number; cumClicks: number }[] = [];
  if (inRange.length > 0) {
    // inRange is reverse-chronological from upstream; find true earliest
    let firstTs = Number.POSITIVE_INFINITY;
    for (const c of inRange) {
      const t = new Date(c.timestamp).getTime();
      if (t < firstTs) firstTs = t;
    }
    const hourBuckets = new Array(DECAY_HORIZON_HOURS + 1).fill(0);
    for (const c of inRange) {
      const dh = Math.floor(
        (new Date(c.timestamp).getTime() - firstTs) / (60 * 60 * 1000),
      );
      const idx = dh >= DECAY_HORIZON_HOURS ? DECAY_HORIZON_HOURS : dh;
      hourBuckets[idx] += 1;
    }
    let cum = 0;
    for (let i = 0; i < hourBuckets.length; i++) {
      cum += hourBuckets[i];
      decay.push({
        hourFromFirst: i,
        clicks: hourBuckets[i],
        cumClicks: cum,
      });
    }
  }

  // --- 6. Top links ---
  const linkClickCount = new Map<string, number>();
  for (const c of inRange) {
    linkClickCount.set(
      c.shortLinkId,
      (linkClickCount.get(c.shortLinkId) || 0) + 1,
    );
  }

  const topLinks = Array.from(linkClickCount.entries())
    .map(([id, clicks]) => {
      const meta = linksById.get(id);
      return {
        id,
        code: meta?.code || "",
        title: meta?.title ?? null,
        originalUrl: meta?.originalUrl || "",
        clicks,
      };
    })
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  // --- 7. UTM aggregations (by link, weighted by its click count in range) ---
  const campaignMap = new Map<string, number>();
  const sourceMap = new Map<string, number>();
  const mediumMap = new Map<string, number>();
  const campaignSourceMap = new Map<
    string,
    { campaign: string; source: string; clicks: number }
  >();
  const campaignContentMap = new Map<
    string,
    { campaign: string; content: string; clicks: number }
  >();

  for (const [id, clicks] of linkClickCount.entries()) {
    const meta = linksById.get(id);
    if (!meta) continue;
    if (meta.utmCampaign) {
      campaignMap.set(
        meta.utmCampaign,
        (campaignMap.get(meta.utmCampaign) || 0) + clicks,
      );
    }
    if (meta.utmSource) {
      sourceMap.set(
        meta.utmSource,
        (sourceMap.get(meta.utmSource) || 0) + clicks,
      );
    }
    if (meta.utmMedium) {
      mediumMap.set(
        meta.utmMedium,
        (mediumMap.get(meta.utmMedium) || 0) + clicks,
      );
    }
    if (meta.utmCampaign && meta.utmSource) {
      const k = `${meta.utmCampaign}|${meta.utmSource}`;
      const existing = campaignSourceMap.get(k);
      if (existing) existing.clicks += clicks;
      else
        campaignSourceMap.set(k, {
          campaign: meta.utmCampaign,
          source: meta.utmSource,
          clicks,
        });
    }
    if (meta.utmCampaign && meta.utmContent) {
      const k = `${meta.utmCampaign}|${meta.utmContent}`;
      const existing = campaignContentMap.get(k);
      if (existing) existing.clicks += clicks;
      else
        campaignContentMap.set(k, {
          campaign: meta.utmCampaign,
          content: meta.utmContent,
          clicks,
        });
    }
  }

  return {
    summary: {
      totalClicks,
      uniqueVisitors,
      clicksChange,
    },
    clicksByDay,
    clicksByHour,
    devices: toNameValue(deviceMap),
    browsers: toNameValue(browserMap),
    operatingSystems: toNameValue(osMap),
    referrers: toNameValue(referrerMap).slice(0, 10),
    countries: toNameValue(countryMap).slice(0, 10),
    cities,
    decay,
    dayHourHeatmap,
    topLinks,
    utm: {
      campaigns: sortAndSlice(campaignMap),
      sources: sortAndSlice(sourceMap),
      mediums: sortAndSlice(mediumMap),
      campaignSource: sortByClicksDesc(
        Array.from(campaignSourceMap.values()),
        15,
      ),
      campaignContent: sortByClicksDesc(
        Array.from(campaignContentMap.values()),
        15,
      ),
    },
  };
}
