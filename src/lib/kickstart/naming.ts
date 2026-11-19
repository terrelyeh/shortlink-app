/**
 * Naming rules for the Kickstart wizard — the same rules the
 * campaign-link-planner skill follows (references/utm-rules.md), so a
 * campaign built here and one planned with the skill look alike.
 *
 * Two flavours per field: `loose*` for onChange (lowercases and replaces
 * invalid characters but keeps a trailing "_" / "-", so people can type
 * "ise_2027" one key at a time) and `clean*` for the final value.
 */

import type { CampaignType } from "./templates";

const stripMarks = (v: string) => v.normalize("NFKD").replace(/\p{M}/gu, "");

/** utm_campaign / utm_content while typing. */
export function looseCampaign(v: string): string {
  return stripMarks(v).toLowerCase().replace(/[^a-z0-9_]+/g, "_");
}

/** utm_campaign / utm_content final form: a–z 0–9 and single "_" separators. */
export function cleanCampaign(v: string): string {
  return looseCampaign(v).replace(/_+/g, "_").replace(/^_+|_+$/g, "");
}

/** Short code while typing. */
export function looseCode(v: string): string {
  return stripMarks(v).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, 50);
}

/** Short code final form (same character set as lib/utils/shortcode). */
export function cleanCode(v: string): string {
  return looseCode(v).replace(/-{2,}/g, "-").replace(/^[-_]+|[-_]+$/g, "");
}

export const CODE_RE = /^[a-z0-9_-]{3,50}$/;

const YEAR4 = /(19|20)\d{2}/;

/**
 * "ISE 2027" (exhibition) → "ise_2027"; "Wi-Fi 7 AP" (launch, 2027) →
 * "wi_fi_7_ap_launch_2027". Adds the start date's year unless the name
 * already carries one ("ISE2027", "Computex-26").
 */
export function suggestCampaign(type: CampaignType, displayName: string, startDay: string | null): string {
  const base = cleanCampaign(displayName);
  if (!base) return "";
  const tokens = base.split("_");
  const hasYear = YEAR4.test(base) || /^\d{2}$/.test(tokens[tokens.length - 1] ?? "");
  const parts = [base];
  if (type === "launch" && !tokens.includes("launch")) parts.push("launch");
  const year = startDay?.slice(0, 4) ?? "";
  if (!hasYear && year) parts.push(year);
  return parts.join("_");
}

/**
 * Short prefix for readable custom codes + 2-digit year:
 * "ise_2027" → "ise27", "interop_tokyo_2026" → "interop26",
 * "wi_fi_7_ap_launch_2027" → "wifi7ap27", "computex-26" → "computex26".
 * Words are joined until the prefix has ≥ 6 characters (short first words
 * like "wi" would otherwise collide); the wizard lets people edit it.
 */
export function codePrefix(campaign: string): string {
  const tokens = campaign.toLowerCase().split(/[_-]+/).filter(Boolean);
  let yy = "";
  const words: string[] = [];
  for (const tok of tokens) {
    const y4 = tok.match(/^(?:19|20)(\d{2})$/) ?? tok.match(/^[a-z]+((?:19|20)\d{2})$/);
    if (/^(19|20)\d{2}$/.test(tok)) {
      yy = tok.slice(-2);
      continue;
    }
    if (y4 && !yy) {
      // "ise2027" → word "ise", year 27
      yy = y4[1].slice(-2);
      words.push(tok.replace(/(19|20)\d{2}$/, ""));
      continue;
    }
    if (/^\d{2}$/.test(tok) && !yy && words.length > 0) {
      yy = tok;
      continue;
    }
    if (tok === "launch") continue;
    words.push(tok);
  }
  let word = words[0] ?? "c";
  for (let i = 1; word.length < 6 && i < words.length; i++) word += words[i];
  return `${word.slice(0, 10)}${yy}`;
}
