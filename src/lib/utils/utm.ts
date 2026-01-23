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

// Medium → Source mapping: shows relevant sources based on selected medium
export const UTM_MEDIUM_SOURCE_MAP: Record<UTMMedium, readonly string[]> = {
  cpc: [
    "google",
    "bing",
    "yahoo",
    "facebook",
    "instagram",
    "linkedin",
    "x",
    "youtube",
    "tiktok",
    "line",
    "pinterest",
    "amazon",
  ],
  social: [
    "facebook",
    "instagram",
    "linkedin",
    "x",
    "youtube",
    "tiktok",
    "line",
    "threads",
    "pinterest",
  ],
  organic: ["google", "bing", "yahoo", "youtube", "duckduckgo"],
  email: [
    "newsletter",
    "edm",
    "marketing_email",
    "mailchimp",
    "hubspot",
    "klaviyo",
    "sendgrid",
  ],
  referral: ["website", "blog", "community", "support", "partner", "amazon"],
  affiliate: ["partner", "reseller", "distributor"],
  display: [
    "google",
    "facebook",
    "instagram",
    "linkedin",
    "x",
    "youtube",
    "tiktok",
    "line",
    "amazon",
  ],
  video: ["youtube", "tiktok", "facebook", "instagram", "vimeo"],
  qr: ["poster", "packaging", "flyer", "product", "namecard", "store"],
  offline: [
    "event",
    "print",
    "tv",
    "radio",
    "billboard",
    "store",
    "direct_mail",
  ],
  influencer: ["youtube", "instagram", "tiktok", "facebook", "blog"],
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
 * Get available sources for a given medium
 */
export function getSourcesForMedium(medium: string): readonly string[] {
  if (medium in UTM_MEDIUM_SOURCE_MAP) {
    return UTM_MEDIUM_SOURCE_MAP[medium as UTMMedium];
  }
  return [];
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
