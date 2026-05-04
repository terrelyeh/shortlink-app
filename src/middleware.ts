import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

// Where external visitors get sent when they poke at anything other
// than `/s/*` / status pages on the public short domain. Bitly/Dub
// pattern — keep the short domain as a dedicated redirector surface,
// never expose Dashboard / sign-in / API to the outside world.
const BRAND_SITE = "https://engeniustech.com";

// Paths the short domain is allowed to serve. Everything else 302s
// to BRAND_SITE. Order-sensitive regexes, anchored to start:
//   - /s/<code>                           (the actual short-link redirect)
//   - /link-<status>                      (expired / inactive / etc.
//                                          redirect targets from /s/*)
//   - /track.js, /api/track               (conversion snippet hosts —
//                                          optional, in case landing
//                                          pages reference the short
//                                          domain instead of the app one)
const SHORT_DOMAIN_ALLOWED = [
  /^\/s\//,
  /^\/link-(expired|inactive|limit-reached|not-yet-active|geo-blocked)(\/|$)/,
  /^\/track\.js$/,
  /^\/api\/track(\/|$)/,
];

// Paths where next-intl should NOT run locale rewriting (same scope
// as the old matcher exclusion list).
const INTL_SKIP = /^\/(?:api|_next|_vercel|s\/|auth\/|link-|share\/|.*\..*)/;

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function isAllowedOnShortDomain(path: string): boolean {
  return SHORT_DOMAIN_ALLOWED.some((re) => re.test(path));
}

// A bare-code path on the short domain — the user-facing form of every
// short link, e.g. `go.engenius.ai/1HbucTM`. The redirect handler lives
// at `/s/[code]`, but we don't want to expose that prefix in shared
// URLs, so we internally rewrite. Matches the same alphabet that the
// shortcode generator uses (Base62 + the `-_` we accept on custom codes).
const SHORT_CODE_PATH = /^\/[a-zA-Z0-9_-]{3,50}$/;

export default function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const path = request.nextUrl.pathname;

  const appHost = hostOf(process.env.NEXT_PUBLIC_APP_URL);
  const shortHost = hostOf(process.env.NEXT_PUBLIC_SHORT_URL);

  // Only enforce short-domain rules when the two domains are actually
  // different. When both env vars point at the same vercel.app URL
  // (no custom domain yet), this check is a no-op and the app behaves
  // like before.
  const splitDomains = appHost && shortHost && appHost !== shortHost;

  if (splitDomains && host === shortHost) {
    // Allowlisted infra paths — pass straight through to the route.
    if (isAllowedOnShortDomain(path)) {
      return NextResponse.next();
    }

    // Short-code path: rewrite to /s/<code> so the existing redirect
    // handler at `src/app/s/[code]/route.ts` does the lookup. Has to
    // come AFTER the allowlist check so /link-expired and friends
    // don't accidentally match this regex.
    if (SHORT_CODE_PATH.test(path)) {
      const url = request.nextUrl.clone();
      url.pathname = `/s${path}`;
      return NextResponse.rewrite(url);
    }

    // Anything else on the short domain → bounce to the brand site.
    return NextResponse.redirect(BRAND_SITE, 302);
  }

  // Main app domain: run intl only on the routes it owns.
  if (INTL_SKIP.test(path)) {
    return NextResponse.next();
  }
  return intlMiddleware(request);
}

export const config = {
  // Match almost everything — we need visibility on /api/* and /auth/*
  // under the short domain so we can 302 them away. Static assets and
  // Next internals are still skipped for perf.
  matcher: [
    "/((?!_next/static|_next/image|_vercel|.*\\.(?:ico|svg|png|jpg|jpeg|gif|webp|woff|woff2|css|js|map)$).*)",
  ],
};
