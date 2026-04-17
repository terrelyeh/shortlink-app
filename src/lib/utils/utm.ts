export interface UTMParams {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
}

// UTM Mediums - user selects medium first
export const UTM_MEDIUMS = [
  "cpc",
  "social",
  "organic",
  "email",
  "referral",
  "affiliate",
  "display",
  "video",
  "qr",
  "offline",
  "influencer",
] as const;

export type UTMMedium = (typeof UTM_MEDIUMS)[number];

// Display labels for medium dropdown — stored value stays as the short
// slug (cpc/social/organic…) but the dropdown shows a plainer description.
export const UTM_MEDIUM_LABELS: Record<UTMMedium, string> = {
  cpc: "cpc — 付費點擊廣告",
  social: "social — 社群自然貼文",
  organic: "organic — 自然搜尋 (SEO)",
  email: "email — Email 行銷",
  referral: "referral — 外部網站推薦",
  affiliate: "affiliate — 聯盟行銷",
  display: "display — 展示型廣告",
  video: "video — 影片廣告",
  qr: "qr — QR Code 掃描",
  offline: "offline — 線下行銷",
  influencer: "influencer — KOL / 網紅",
};

export interface UtmSourceOption {
  /** Stored value in utm_source (must be lowercase/machine-friendly) */
  value: string;
  /** Human-readable label shown in the dropdown */
  label: string;
}

// Medium → Source mapping with human-readable labels.
// The `value` is what gets stored; the `label` is what the user sees.
export const UTM_MEDIUM_SOURCE_OPTIONS: Record<UTMMedium, readonly UtmSourceOption[]> = {
  cpc: [
    { value: "google", label: "Google Ads" },
    { value: "facebook", label: "Facebook Ads (Meta)" },
    { value: "instagram", label: "Instagram Ads (Meta)" },
    { value: "bing", label: "Bing / Microsoft Ads" },
    { value: "yahoo", label: "Yahoo Ads" },
    { value: "linkedin", label: "LinkedIn Ads" },
    { value: "x", label: "X / Twitter Ads" },
    { value: "youtube", label: "YouTube Ads" },
    { value: "tiktok", label: "TikTok Ads" },
    { value: "line", label: "LINE Ads" },
    { value: "pinterest", label: "Pinterest Ads" },
    { value: "amazon", label: "Amazon Ads" },
  ],
  social: [
    { value: "facebook", label: "Facebook (organic)" },
    { value: "instagram", label: "Instagram (organic)" },
    { value: "linkedin", label: "LinkedIn (organic)" },
    { value: "x", label: "X / Twitter (organic)" },
    { value: "youtube", label: "YouTube (organic)" },
    { value: "tiktok", label: "TikTok (organic)" },
    { value: "line", label: "LINE (organic)" },
    { value: "threads", label: "Threads" },
    { value: "pinterest", label: "Pinterest" },
  ],
  organic: [
    { value: "google", label: "Google Search" },
    { value: "bing", label: "Bing Search" },
    { value: "yahoo", label: "Yahoo Search" },
    { value: "youtube", label: "YouTube Search" },
    { value: "duckduckgo", label: "DuckDuckGo" },
  ],
  email: [
    { value: "newsletter", label: "Newsletter (電子報)" },
    { value: "edm", label: "EDM" },
    { value: "marketing_email", label: "Marketing Email" },
    { value: "mailchimp", label: "Mailchimp" },
    { value: "hubspot", label: "HubSpot" },
    { value: "klaviyo", label: "Klaviyo" },
    { value: "sendgrid", label: "SendGrid" },
  ],
  referral: [
    { value: "website", label: "Partner Website" },
    { value: "blog", label: "Blog / Media Site" },
    { value: "community", label: "Community / Forum" },
    { value: "support", label: "Support Portal" },
    { value: "partner", label: "Partner (或自訂 partner_xxx)" },
    { value: "amazon", label: "Amazon (referral)" },
  ],
  affiliate: [
    { value: "partner", label: "Affiliate Partner (或 partner_xxx)" },
    { value: "reseller", label: "Reseller" },
    { value: "distributor", label: "Distributor" },
  ],
  display: [
    { value: "google", label: "Google Display Network" },
    { value: "facebook", label: "Facebook Display" },
    { value: "instagram", label: "Instagram Display" },
    { value: "linkedin", label: "LinkedIn Display" },
    { value: "x", label: "X / Twitter Display" },
    { value: "youtube", label: "YouTube Display" },
    { value: "tiktok", label: "TikTok Display" },
    { value: "line", label: "LINE Display" },
    { value: "amazon", label: "Amazon Display" },
  ],
  video: [
    { value: "youtube", label: "YouTube" },
    { value: "tiktok", label: "TikTok" },
    { value: "facebook", label: "Facebook Video" },
    { value: "instagram", label: "Instagram Reels" },
    { value: "vimeo", label: "Vimeo" },
  ],
  qr: [
    { value: "poster", label: "Poster 海報" },
    { value: "packaging", label: "Product Packaging 包裝" },
    { value: "flyer", label: "Flyer 傳單" },
    { value: "product", label: "Product Label 產品標籤" },
    { value: "namecard", label: "Business Card 名片" },
    { value: "store", label: "In-store Display 店內" },
  ],
  offline: [
    { value: "event", label: "Event / Conference 活動" },
    { value: "print", label: "Print Ad 平面廣告" },
    { value: "tv", label: "TV Ad 電視廣告" },
    { value: "radio", label: "Radio Ad 廣播" },
    { value: "billboard", label: "Billboard 戶外看板" },
    { value: "store", label: "Physical Store 實體店" },
    { value: "direct_mail", label: "Direct Mail 直郵" },
  ],
  influencer: [
    { value: "youtube", label: "YouTube Creator (或 kol_name)" },
    { value: "instagram", label: "Instagram Creator (或 kol_name)" },
    { value: "tiktok", label: "TikTok Creator (或 kol_name)" },
    { value: "facebook", label: "Facebook Creator" },
    { value: "blog", label: "Blogger" },
  ],
};

/**
 * Legacy flat source-value map. Derived from UTM_MEDIUM_SOURCE_OPTIONS so
 * existing call-sites (BatchCreateForm, validation helpers) keep working
 * with plain string[] semantics.
 */
export const UTM_MEDIUM_SOURCE_MAP: Record<UTMMedium, readonly string[]> =
  Object.fromEntries(
    Object.entries(UTM_MEDIUM_SOURCE_OPTIONS).map(([medium, opts]) => [
      medium,
      opts.map((o) => o.value),
    ]),
  ) as unknown as Record<UTMMedium, readonly string[]>;

/**
 * Inline copy shown below the Source field when a medium is selected.
 * Orients the user: what is this medium, what should I put in source,
 * and what's a gotcha to avoid.
 */
export const UTM_MEDIUM_CONTEXT: Record<
  UTMMedium,
  { title: string; tip: string }
> = {
  cpc: {
    title: "付費點擊廣告 (Paid Search / Social Ads)",
    tip: "選擇你投放廣告的平台。注意：Facebook 粉專『免費發文』不算 cpc，應選 social。",
  },
  social: {
    title: "社群自然貼文 (Organic Social)",
    tip: "粉專、個人帳號的免費發文。如果是付費投放 (Boost)，請改選 medium=cpc。",
  },
  organic: {
    title: "自然搜尋 (Organic Search)",
    tip: "從搜尋引擎結果頁 (SERP) 點進來的訪客，通常用於追蹤 SEO 成效。",
  },
  email: {
    title: "Email 行銷",
    tip: "電子報、EDM、自動化 nurture 信。建議 source 用『寄信工具名』或『活動代號』。",
  },
  referral: {
    title: "外部網站推薦",
    tip: "別的網站掛你的連結（媒體報導、合作夥伴）。可用 partner_xxx 自訂合作夥伴。",
  },
  affiliate: {
    title: "聯盟行銷",
    tip: "分潤合作、推薦碼。可用 partner_xxx 自訂具體聯盟身份。",
  },
  display: {
    title: "展示型廣告 (Banner / Display Ads)",
    tip: "圖像 banner、GDN 等。跟 cpc 的差別：display 通常按曝光計費、關注品牌知名度。",
  },
  video: {
    title: "影片廣告",
    tip: "YouTube、TikTok、Reels 等影片平台的廣告投放。",
  },
  qr: {
    title: "QR Code 掃描",
    tip: "實體掃碼進來的流量。建議 source 用具體位置，例如 flyer_computex、packaging_v2。",
  },
  offline: {
    title: "線下行銷",
    tip: "實體活動、印刷品、廣播、電視、戶外看板。",
  },
  influencer: {
    title: "網紅 / KOL 合作",
    tip: "合作的創作者平台。建議用 kol_<name> 自訂，例如 kol_shintaro。",
  },
};

// Source aliases for normalization
export const UTM_SOURCE_ALIASES: Record<string, string> = {
  fb: "facebook",
  meta: "facebook",
  ig: "instagram",
  li: "linkedin",
  twitter: "x",
  google_ads: "google",
  gads: "google",
  e_dm: "edm",
  mc: "mailchimp",
  yt: "youtube",
  tt: "tiktok",
};

// Custom source configuration
export const UTM_CUSTOM_SOURCE_CONFIG = {
  allowedPrefixes: ["partner_", "kol_", "event_"],
  allowedMediums: ["referral", "affiliate", "influencer", "offline"] as UTMMedium[],
};

// Get all unique sources (for backward compatibility)
export const UTM_SOURCES = [
  ...new Set(Object.values(UTM_MEDIUM_SOURCE_MAP).flat()),
] as const;

/**
 * Get available sources for a given medium (legacy: value-only list)
 */
export function getSourcesForMedium(medium: string): readonly string[] {
  if (medium in UTM_MEDIUM_SOURCE_MAP) {
    return UTM_MEDIUM_SOURCE_MAP[medium as UTMMedium];
  }
  return [];
}

/**
 * Get source options (value + label) for a given medium — use this for
 * UI rendering so the dropdown can show "Google Ads" instead of "google".
 */
export function getSourceOptionsForMedium(
  medium: string,
): readonly UtmSourceOption[] {
  if (medium in UTM_MEDIUM_SOURCE_OPTIONS) {
    return UTM_MEDIUM_SOURCE_OPTIONS[medium as UTMMedium];
  }
  return [];
}

/**
 * Context copy for the inline hint shown below the Source field.
 */
export function getMediumContext(
  medium: string,
): { title: string; tip: string } | null {
  if (medium in UTM_MEDIUM_CONTEXT) {
    return UTM_MEDIUM_CONTEXT[medium as UTMMedium];
  }
  return null;
}

/**
 * Check if custom source is allowed for a medium
 */
export function isCustomSourceAllowed(medium: string): boolean {
  return UTM_CUSTOM_SOURCE_CONFIG.allowedMediums.includes(medium as UTMMedium);
}

/**
 * Normalize source value using aliases
 */
export function normalizeSource(source: string): string {
  const lowered = source.toLowerCase().trim();
  return UTM_SOURCE_ALIASES[lowered] || lowered;
}

/**
 * Validate if a source is valid for a given medium
 */
export function isValidSourceForMedium(
  source: string,
  medium: string
): { valid: boolean; normalized: string; warning?: string } {
  const normalizedSource = normalizeSource(source);
  const availableSources = getSourcesForMedium(medium);

  // Check if source is in the allowed list
  if (availableSources.includes(normalizedSource)) {
    return { valid: true, normalized: normalizedSource };
  }

  // Check if custom source is allowed
  if (isCustomSourceAllowed(medium)) {
    const hasValidPrefix = UTM_CUSTOM_SOURCE_CONFIG.allowedPrefixes.some(
      (prefix) => normalizedSource.startsWith(prefix)
    );
    if (hasValidPrefix) {
      return { valid: true, normalized: normalizedSource };
    }
  }

  // Source not in list - warn but allow
  return {
    valid: true,
    normalized: normalizedSource,
    warning: `"${normalizedSource}" is not a common source for medium "${medium}"`,
  };
}

/**
 * Build a URL with UTM parameters
 */
export function buildUrlWithUTM(baseUrl: string, params: UTMParams): string {
  try {
    const url = new URL(baseUrl);

    if (params.source) url.searchParams.set("utm_source", params.source);
    if (params.medium) url.searchParams.set("utm_medium", params.medium);
    if (params.campaign) url.searchParams.set("utm_campaign", params.campaign);
    if (params.content) url.searchParams.set("utm_content", params.content);
    if (params.term) url.searchParams.set("utm_term", params.term);

    return url.toString();
  } catch {
    return baseUrl;
  }
}

/**
 * Parse UTM parameters from a URL
 */
export function parseUTMFromUrl(urlString: string): UTMParams {
  try {
    const url = new URL(urlString);
    return {
      source: url.searchParams.get("utm_source") || undefined,
      medium: url.searchParams.get("utm_medium") || undefined,
      campaign: url.searchParams.get("utm_campaign") || undefined,
      content: url.searchParams.get("utm_content") || undefined,
      term: url.searchParams.get("utm_term") || undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Validate UTM parameter value (no spaces or special characters)
 */
export function isValidUTMValue(value: string): boolean {
  // Allow alphanumeric, underscores, hyphens, and plus signs
  const pattern = /^[a-zA-Z0-9_+-]+$/;
  return pattern.test(value);
}

/**
 * Sanitize UTM value by replacing spaces with underscores
 */
export function sanitizeUTMValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_+-]/g, "");
}
