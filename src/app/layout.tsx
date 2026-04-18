/**
 * Root layout — provides the required <html>/<body> wrapper for every page
 * under /src/app/, including non-localised status pages (/link-expired,
 * /link-geo-blocked, /share/[token], etc.) that don't live under [locale]/.
 *
 * Localised pages under [locale]/ get further wrapped by that route's
 * layout (NextIntlClientProvider, etc.) — nested layouts compose.
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Short Link Manager",
  description: "Internal Marketing URL Shortener",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // lang defaults to "en"; the locale layout used to override this via
  // <html lang={locale}> but Next.js only allows one <html> per render tree.
  // If precise lang matters later, a client-side effect on the locale layout
  // can set document.documentElement.lang on mount.
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
