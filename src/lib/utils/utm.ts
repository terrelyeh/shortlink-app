export interface UTMParams {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
}

// Common UTM sources for dropdown
export const UTM_SOURCES = [
  "facebook",
  "instagram",
  "twitter",
  "linkedin",
  "google",
  "youtube",
  "tiktok",
  "email",
  "newsletter",
  "direct",
] as const;

// Common UTM mediums for dropdown
export const UTM_MEDIUMS = [
  "cpc",
  "cpm",
  "social",
  "email",
  "organic",
  "referral",
  "display",
  "video",
  "affiliate",
  "paid_social",
] as const;

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
