"use client";

/**
 * Dashboard footer — minimal, lives at the bottom of the main content
 * area. Currently surfaces in-app help notes; intent is for it to grow
 * into a small "release notes / changelog / support" hub as features
 * land. Kept client-side because the link list will eventually pull
 * dynamic content (release dates, "new" badges).
 */

import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer
      style={{
        marginTop: 48,
        paddingTop: 20,
        paddingBottom: 24,
        borderTop: "1px solid var(--border)",
        fontSize: 12.5,
        color: "var(--ink-500)",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 16,
      }}
    >
      <span style={{ marginRight: "auto" }}>{t("notesLabel")}</span>
      <Link
        href="/notes/test-clicks"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "var(--ink-400)",
          textDecoration: "none",
          transition: "color 0.12s var(--ease)",
        }}
        className="footer-link"
      >
        <FileText size={12} />
        <span>{t("testClicksNote")}</span>
      </Link>

      <style>{`
        .footer-link:hover {
          color: var(--brand-700) !important;
          text-decoration: underline;
        }
      `}</style>
    </footer>
  );
}
