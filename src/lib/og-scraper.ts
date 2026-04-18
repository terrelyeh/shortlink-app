/**
 * Lightweight Open Graph scraper — fetches a URL's HTML and extracts
 * og:image / og:title / og:description (with fallback to <title> and
 * <meta name="description">).
 *
 * No HTML parser dependency: we use targeted regexes on the head. That's
 * good enough for 95% of sites and keeps the bundle small. Used only
 * server-side from `after()` background jobs so failure modes are cheap.
 *
 * Safety:
 *   - 5s abort timeout — we're opportunistic, not blocking
 *   - Size cap: read at most 512KB of HTML. Some sites dump entire
 *     inline fonts in head; we don't need to download them all
 *   - Never throws — returns null on any error
 */

const TIMEOUT_MS = 5_000;
const MAX_BYTES = 512 * 1024;

export interface OpenGraphData {
  image: string | null;
  title: string | null;
  description: string | null;
}

/** Extract a meta tag value by (property|name) — case-insensitive, handles single/double quotes. */
function matchMeta(html: string, key: string): string | null {
  // Either <meta property="og:image" content="..."> or content before property
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return decode(m[1]);
  }
  return null;
}

function matchTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1] ? decode(m[1]).trim() : null;
}

// Minimal HTML entity decoder — good enough for meta content.
function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

/** Resolve relative URLs in og:image against the source URL. */
function absolutise(maybeUrl: string | null, baseUrl: string): string | null {
  if (!maybeUrl) return null;
  try {
    return new URL(maybeUrl, baseUrl).toString();
  } catch {
    return null;
  }
}

export async function fetchOpenGraph(url: string): Promise<OpenGraphData | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
      headers: {
        // Some sites block unknown UAs. Present as a generic bot; also
        // tag ourselves so site owners can identify traffic in logs.
        "User-Agent":
          "Mozilla/5.0 (compatible; ShortlinkBot/1.0; +link-preview)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok || !res.body) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("html")) return null;

    // Stream only the first MAX_BYTES of the body. Open Graph tags live in
    // <head>, so truncating is safe and saves network + memory for giant pages.
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
    }
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }

    const html = new TextDecoder("utf-8", { fatal: false }).decode(
      Buffer.concat(chunks.map((c) => Buffer.from(c))),
    );

    const ogImage = matchMeta(html, "og:image") ?? matchMeta(html, "twitter:image");
    const ogTitle = matchMeta(html, "og:title") ?? matchTitle(html);
    const ogDescription =
      matchMeta(html, "og:description") ?? matchMeta(html, "description");

    return {
      image: absolutise(ogImage, res.url || url),
      title: ogTitle ? ogTitle.slice(0, 200) : null,
      description: ogDescription ? ogDescription.slice(0, 500) : null,
    };
  } catch {
    return null;
  }
}
