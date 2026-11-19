/**
 * Naming rules for the Kickstart wizard — the same rules the
 * campaign-link-planner skill follows (references/utm-rules.md), so a
 * campaign built here and one planned with the skill look alike.
 */

import type { CampaignType } from "./templates";

/** utm_campaign: lowercase a–z 0–9 and "_" only. */
export function cleanCampaign(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

/**
 * "ISE 2027" (exhibition) → "ise_2027"; "Wi-Fi 7 AP" (launch, 2027) →
 * "wi_fi_7_ap_launch_2027". The year comes from the start date when the
 * name doesn't already carry one.
 */
export function suggestCampaign(type: CampaignType, displayName: string, startDay: string | null): string {
  const base = cleanCampaign(displayName);
  if (!base) return "";
  const year = startDay?.slice(0, 4) ?? "";
  const hasYear = /(^|_)(19|20)\d{2}($|_)/.test(base);
  const parts = [base];
  if (type === "launch" && !/(^|_)launch($|_)/.test(base)) parts.push("launch");
  if (!hasYear && year) parts.push(year);
  return parts.join("_");
}

/**
 * Short prefix for readable custom codes: first word (≤ 8 chars) + 2-digit
 * year. "ise_2027" → "ise27", "interop_tokyo_2026" → "interop26",
 * "computex-26" → "computex26".
 */
export function codePrefix(campaign: string): string {
  const tokens = campaign.split(/[_-]+/).filter(Boolean);
  const yearTok = tokens.find((t) => /^(19|20)\d{2}$/.test(t)) ?? tokens.find((t) => /^\d{2}$/.test(t));
  const yy = yearTok ? yearTok.slice(-2) : "";
  const word = (tokens.find((t) => /[a-z]/.test(t)) ?? "c").slice(0, 8);
  return `${word}${yy}`;
}

/** Custom codes: 3–50 of a–z 0–9 - _ (same check as lib/utils/shortcode). */
export function cleanCode(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export const CODE_RE = /^[a-z0-9_-]{3,50}$/;
