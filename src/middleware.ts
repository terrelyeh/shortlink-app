import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except:
  // - API routes
  // - Static files
  // - Short link redirects (/s/...)
  // - Auth routes (handled separately)
  matcher: [
    "/((?!api|_next|_vercel|s/|auth/|.*\\..*).*)",
  ],
};
