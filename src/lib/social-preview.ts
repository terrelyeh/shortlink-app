/**
 * Social-preview override support for the redirect route.
 *
 * Link-preview crawlers don't run JS and read og:* tags from whatever URL
 * they end up on. Normally they follow our 302 and read the destination's
 * tags. When a link has an override, we answer the crawler directly with
 * a tiny HTML page carrying our tags instead.
 *
 * Only *preview* crawlers are matched here — search-engine bots and
 * generic HTTP clients keep getting the plain redirect.
 */

// Facebook's crawler also serves Threads, Instagram and Messenger; LINE
// identifies as "facebookexternalhit/1.1;line-poker/1.0".
const PREVIEW_CRAWLER_PATTERNS = [
  /facebookexternalhit/i,
  /facebot/i,
  /line-poker/i,
  /linkedinbot/i,
  /twitterbot/i,
  /slackbot/i,
  /discordbot/i,
  /telegrambot/i,
  /whatsapp/i,
  /skypeuripreview/i,
  /pinterest/i,
  /redditbot/i,
  /embedly/i,
  /iframely/i,
  /kakaotalk-scrap/i,
  /applebot/i, // iMessage link previews
];

export function isPreviewCrawler(ua: string | null): boolean {
  if (!ua) return false;
  return PREVIEW_CRAWLER_PATTERNS.some((p) => p.test(ua));
}

export interface PreviewLink {
  code: string;
  title: string | null;
  originalUrl: string;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  ogOverrideTitle: string | null;
  ogOverrideDescription: string | null;
  ogOverrideImage: string | null;
}

export function hasPreviewOverride(link: PreviewLink): boolean {
  return Boolean(link.ogOverrideTitle || link.ogOverrideDescription || link.ogOverrideImage);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * HTML for preview crawlers. Override fields win; empty ones fall back to
 * the scraped destination metadata so a marketer can change just the image.
 * A meta refresh is included in case a real browser ever lands here
 * (e.g. an in-app browser with a crawler-like UA).
 */
export function renderPreviewHtml(link: PreviewLink, shortUrl: string): string {
  const title = link.ogOverrideTitle || link.ogTitle || link.title || shortUrl;
  const description = link.ogOverrideDescription || link.ogDescription || "";
  const image = link.ogOverrideImage || link.ogImage || "";

  const tags = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${escapeHtml(shortUrl)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
  ];
  if (description) {
    tags.push(
      `<meta property="og:description" content="${escapeHtml(description)}">`,
      `<meta name="description" content="${escapeHtml(description)}">`,
      `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    );
  }
  if (image) {
    tags.push(
      `<meta property="og:image" content="${escapeHtml(image)}">`,
      `<meta name="twitter:image" content="${escapeHtml(image)}">`,
      `<meta name="twitter:card" content="summary_large_image">`,
    );
  } else {
    tags.push(`<meta name="twitter:card" content="summary">`);
  }

  const dest = escapeHtml(/^https?:\/\//i.test(link.originalUrl) ? link.originalUrl : shortUrl);
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
${tags.join("\n")}
<meta http-equiv="refresh" content="0;url=${dest}">
</head><body><a href="${dest}">${escapeHtml(title)}</a></body></html>`;
}
