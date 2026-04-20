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
    if (!isAllowedOnShortDomain(path)) {
      return NextResponse.redirect(BRAND_SITE, 302);
    }
    return NextResponse.next();
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
