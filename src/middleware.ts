import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except:
  // - API routes
  // - Static files
  // - Short link redirects (/s/...)
  // - Auth routes (handled separately)
  // Keep the intl middleware away from:
  //   - api / _next / _vercel (framework + assets)
  //   - s/        (short-link redirect endpoint)
  //   - auth/     (NextAuth pages)
  //   - link-*    (status landing pages served at root — link-expired,
  //                link-inactive, link-limit-reached, link-not-yet-active,
  //                link-geo-blocked). Previously intl rewrote these to
  //                /[locale]/link-* and they 404'd.
  //   - share/    (public report pages — token routes aren't localised)
  //   - .*\\.*    (files with extensions)
  matcher: [
    "/((?!api|_next|_vercel|s/|auth/|link-|share/|.*\\..*).*)",
  ],
};
