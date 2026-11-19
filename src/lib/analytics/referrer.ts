/**
 * Group raw referrer URLs into one row per site.
 *
 * Raw referrers are full URLs (every Mailchimp archive page, every news
 * article) so a "top referrers" list of URLs splits one source into dozens
 * of rows. We reduce each to its site: the registrable domain, with a few
 * well-known families given their brand name so marketers recognise them
 * (us8.list-manage.com and mailchimp.com are both "Mailchimp").
 *
 * Note most clicks carry no referrer at all (email apps, QR scans, in-app
 * browsers) — see CLAUDE.md "流量來源要看 UTM". These are not grouped here;
 * callers treat a null referrer as "no referrer".
 */

// Brand families. Matched against the registrable domain.
const FAMILY: Record<string, string> = {
  "list-manage.com": "Mailchimp",
  "mailchimp.com": "Mailchimp",
  "linkedin.com": "LinkedIn",
  "lnkd.in": "LinkedIn",
  "facebook.com": "Facebook",
  "fb.com": "Facebook",
  "instagram.com": "Instagram",
  "t.co": "X (Twitter)",
  "x.com": "X (Twitter)",
  "twitter.com": "X (Twitter)",
  "youtube.com": "YouTube",
  "line.me": "LINE",
  "doubleclick.net": "Google Ads",
  "googlesyndication.com": "Google Ads",
  "googleadservices.com": "Google Ads",
  "amazon-adsystem.com": "Amazon Ads",
};

// Android apps send android-app://<package>/ as the referrer.
const ANDROID_APP: Record<string, string> = {
  "com.google.android.gm": "Gmail (app)",
  "com.linkedin.android": "LinkedIn",
  "com.facebook.katana": "Facebook",
  "com.facebook.orca": "Messenger",
  "jp.naver.line.android": "LINE",
  "com.google.android.googlequicksearchbox": "Google",
  "com.microsoft.office.outlook": "Outlook (app)",
};

// Second-level suffixes where the registrable domain has three labels.
const MULTI_SUFFIX = new Set([
  "co.jp", "ne.jp", "or.jp", "ac.jp", "go.jp",
  "co.uk", "org.uk", "ac.uk",
  "com.tw", "org.tw", "gov.tw", "edu.tw",
  "com.au", "com.cn", "com.hk", "com.sg", "co.kr", "co.in", "com.br",
]);

function registrableDomain(host: string): string {
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const lastTwo = parts.slice(-2).join(".");
  if (MULTI_SUFFIX.has(lastTwo)) return parts.slice(-3).join(".");
  return lastTwo;
}

/**
 * "https://us8.list-manage.com/track/…" → "Mailchimp";
 * "https://www.prnewswire.com/apac/…" → "prnewswire.com";
 * "android-app://com.google.android.gm/" → "Gmail (app)".
 * Returns null for an empty referrer, the raw string if it isn't a URL.
 */
export function referrerSite(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return referrer;
  }
  if (url.protocol === "android-app:") {
    const pkg = url.hostname.toLowerCase();
    return ANDROID_APP[pkg] ?? pkg;
  }
  const host = url.hostname.toLowerCase();
  if (!host) return referrer;
  const domain = registrableDomain(host);
  return FAMILY[domain] ?? domain;
}
