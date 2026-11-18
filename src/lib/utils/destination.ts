const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

/**
 * Human-readable destination for list views: host without "www." plus
 * path and any non-UTM query. UTM params are dropped because the table
 * already shows them as their own columns — leaving them in pushed the
 * actual page path out of view.
 *
 * `cleanUrl` is the destination without UTM params — use it for any
 * "open destination" link in the dashboard so a teammate peeking at the
 * page doesn't log a fake campaign visit in GA. Empty for non-http(s)
 * URLs — render the destination as plain text then.
 */
export function formatDestination(rawUrl: string): { host: string; rest: string; cleanUrl: string } {
  try {
    const url = new URL(rawUrl);
    UTM_PARAMS.forEach((p) => url.searchParams.delete(p));
    const host = url.hostname.replace(/^www\./, "");
    let rest = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
    const query = url.searchParams.toString();
    if (query) rest += `?${query}`;
    if (url.hash) rest += url.hash;
    // Only http(s) is safe to put in an href in the dashboard.
    const cleanUrl = /^https?:$/.test(url.protocol) ? url.toString() : "";
    return { host, rest, cleanUrl };
  } catch {
    return { host: rawUrl.replace(/^https?:\/\/(www\.)?/, ""), rest: "", cleanUrl: "" };
  }
}
