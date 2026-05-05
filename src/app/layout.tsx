/**
 * Root layout — provides the required <html>/<body> wrapper for every page
 * under /src/app/, including non-localised status pages (/link-expired,
 * /link-geo-blocked, /share/[token], etc.) that don't live under [locale]/.
 */

import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "EnGenius ShortLink",
  description: "Internal Marketing URL Shortener",
};

// Viewport — required for mobile to render at the correct width
// instead of the desktop-emulating 980px default. Allow user zoom for
// accessibility (don't lock to maximum-scale=1).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
