/**
 * GET /track.js — public, cacheable JS snippet that landing pages embed
 * to record conversions back to the short link they came from.
 *
 *     <script src="https://mkt-shortlink.vercel.app/track.js" async></script>
 *     <script>
 *       // Once the customer hits "purchase complete" — fire a conversion
 *       Shortlink.convert({ event: 'purchase', value: 1990, currency: 'TWD', externalId: 'order_123' });
 *     </script>
 *
 * Design notes:
 *   - Reads the session token from ?_sl= on first load, persists to
 *     sessionStorage so follow-up page navigations still attribute
 *   - Cleans ?_sl from the address bar via history.replaceState so it
 *     doesn't pollute GA referrer or get shared in URLs
 *   - Uses keepalive so conversions fire even on page-unload events
 *   - Small enough to inline; we still serve it as an asset so browsers
 *     cache it and landing pages get updates for free when we deploy
 */

import { NextResponse } from "next/server";

const SNIPPET = `(function(){
  var SID_KEY = "_sl_sid";
  var ENDPOINT_KEY = "_sl_endpoint";
  var sid = null;
  var endpoint = null;

  // Resolve the endpoint from this script's own URL so the snippet works
  // no matter what domain it's hosted on.
  try {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src || "";
      if (src.indexOf("/track.js") !== -1) {
        endpoint = new URL(src).origin + "/api/track";
        break;
      }
    }
  } catch (e) { /* no-op */ }

  // Read session from URL, fall back to sessionStorage.
  try {
    var qs = new URLSearchParams(window.location.search);
    var fromUrl = qs.get("_sl");
    if (fromUrl) {
      sid = fromUrl;
      try { sessionStorage.setItem(SID_KEY, sid); } catch (e) {}
      // Strip _sl from the address bar so it doesn't leak into GA / shares.
      if (window.history && window.history.replaceState) {
        qs.delete("_sl");
        var q = qs.toString();
        var url = window.location.pathname + (q ? "?" + q : "") + window.location.hash;
        window.history.replaceState({}, "", url);
      }
    } else {
      try { sid = sessionStorage.getItem(SID_KEY); } catch (e) {}
    }
  } catch (e) { /* no-op */ }

  if (endpoint) {
    try { sessionStorage.setItem(ENDPOINT_KEY, endpoint); } catch (e) {}
  } else {
    try { endpoint = sessionStorage.getItem(ENDPOINT_KEY); } catch (e) {}
  }

  function convert(data) {
    if (!sid || !endpoint) {
      return Promise.resolve({ ok: false, reason: !sid ? "no_session" : "no_endpoint" });
    }
    var payload = { sessionId: sid };
    if (data && typeof data === "object") {
      if (data.event) payload.eventName = String(data.event);
      if (typeof data.value === "number") payload.value = data.value;
      if (data.currency) payload.currency = String(data.currency).toUpperCase();
      if (data.externalId) payload.externalId = String(data.externalId);
      if (data.metadata && typeof data.metadata === "object") payload.metadata = data.metadata;
    }
    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "omit",
      keepalive: true
    })
      .then(function(r) { return r.json().catch(function() { return { ok: r.ok }; }); })
      .catch(function() { return { ok: false, reason: "network" }; });
  }

  window.Shortlink = window.Shortlink || {};
  window.Shortlink.convert = convert;
  window.Shortlink.sessionId = function() { return sid; };
})();
`;

export function GET() {
  return new NextResponse(SNIPPET, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Public, cacheable. 1h browser, 24h CDN, 7d stale-while-revalidate.
      // A redeploy busts the CDN anyway, so the long s-maxage is safe.
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
