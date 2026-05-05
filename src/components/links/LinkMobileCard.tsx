"use client";

/**
 * Mobile-friendly card representation of a single link. Used by
 * LinksClient on narrow viewports instead of the wide desktop table.
 * Renders the same data + action menu, just stacked vertically with
 * larger tap targets.
 */

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Copy,
  Check,
  MoreVertical,
  Edit,
  Trash2,
  QrCode,
  BarChart3,
  Pause,
  Play,
  CopyPlus,
  TrendingUp,
  TrendingDown,
  CalendarClock,
  Globe2,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { StatusDot } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

interface LinkTag {
  tag: { id: string; name: string; color?: string | null };
}

export interface LinkMobileCardProps {
  link: {
    id: string;
    code: string;
    originalUrl: string;
    title?: string | null;
    status: string;
    createdAt: string;
    startsAt?: string | null;
    allowedCountries?: string[];
    utmCampaign?: string | null;
    utmMedium?: string | null;
    utmSource?: string | null;
    clicksLast7d?: number;
    trendPct?: number | null;
    ogImage?: string | null;
    ogTitle?: string | null;
    _count: { clicks: number; conversions?: number };
    tags?: LinkTag[];
  };
  shortBaseUrl: string;
  selected: boolean;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: string) => void;
  onClone?: (id: string) => void;
}

export function LinkMobileCard({
  link,
  shortBaseUrl,
  selected,
  onSelect,
  onDelete,
  onStatusChange,
  onClone,
}: LinkMobileCardProps) {
  const t = useTranslations("links");
  const { success } = useToast();
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  useEffect(() => {
    if (showMenu && menuBtnRef.current) {
      const rect = menuBtnRef.current.getBoundingClientRect();
      const menuWidth = 200;
      const menuHeight = 280;
      const spaceBelow = window.innerHeight - rect.bottom;
      setMenuPos({
        top:
          spaceBelow < menuHeight ? rect.top - menuHeight : rect.bottom + 4,
        left: Math.max(8, rect.right - menuWidth),
      });
    }
  }, [showMenu]);

  const shortUrl = `${shortBaseUrl}/${link.code}`;
  const shortUrlDisplay = shortUrl.replace(/^https?:\/\//, "");

  const statusLabel =
    link.status === "ACTIVE"
      ? t("active")
      : link.status === "PAUSED"
        ? t("paused")
        : t("archived");

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    success(t("copySuccess") || "Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = () => {
    onDelete?.(link.id);
    setShowMenu(false);
  };

  const toggleStatus = () => {
    const newStatus = link.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    onStatusChange?.(link.id, newStatus);
    setShowMenu(false);
  };

  const handleClone = () => {
    onClone?.(link.id);
    setShowMenu(false);
  };

  const trendPct = link.trendPct ?? null;
  const hasTrend = trendPct !== null && trendPct !== 0;
  const scheduled =
    link.startsAt && new Date(link.startsAt) > new Date() ? link.startsAt : null;
  const geoLimited =
    link.allowedCountries && link.allowedCountries.length > 0
      ? link.allowedCountries
      : null;

  return (
    <div className="link-mobile-card">
      {/* Top: checkbox · OG · title · menu */}
      <div className="lmc-head">
        <button
          onClick={() => onSelect(link.id)}
          className={`lmc-checkbox ${selected ? "checked" : ""}`}
          aria-label="Select"
        >
          {selected && (
            <svg
              width="11"
              height="11"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {link.ogImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={link.ogImage}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
            className="lmc-og"
          />
        ) : (
          <div className="lmc-og lmc-og-fallback">
            {(link.title || link.code).charAt(0).toUpperCase()}
          </div>
        )}

        <div className="lmc-title-block">
          <p className="lmc-title" title={link.ogTitle ?? undefined}>
            {link.title || `/${link.code}`}
          </p>
          <p className="lmc-dest" title={link.originalUrl}>
            {link.originalUrl
              .replace(/^https?:\/\/(www\.)?/, "")
              .substring(0, 60)}
          </p>
        </div>

        <button
          ref={menuBtnRef}
          onClick={() => setShowMenu((v) => !v)}
          className="lmc-menu-btn"
          aria-label="More"
        >
          <MoreVertical size={16} />
        </button>
      </div>

      {/* Short URL — primary action: copy */}
      <button onClick={copyToClipboard} className="lmc-short-row">
        <span className="lmc-short">{shortUrlDisplay}</span>
        {copied ? (
          <Check size={14} style={{ color: "var(--ok-fg)", flexShrink: 0 }} />
        ) : (
          <Copy size={14} style={{ color: "var(--ink-400)", flexShrink: 0 }} />
        )}
      </button>

      {/* Pills row: campaign / medium / source / tags */}
      {(link.utmCampaign ||
        link.utmMedium ||
        link.utmSource ||
        (link.tags && link.tags.length > 0)) && (
        <div className="lmc-pills">
          {link.utmCampaign && (
            <span className="pill pill-campaign" title="utm_campaign">
              {link.utmCampaign}
            </span>
          )}
          {link.utmMedium && (
            <span className="pill pill-medium" title="utm_medium">
              {link.utmMedium}
            </span>
          )}
          {link.utmSource && (
            <span className="pill pill-source" title="utm_source">
              {link.utmSource}
            </span>
          )}
          {link.tags?.slice(0, 3).map((t) => (
            <span
              key={t.tag.id}
              className="pill"
              style={{
                background: t.tag.color || "var(--bg-subtle)",
                color: "var(--ink-200)",
              }}
            >
              {t.tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Constraint badges (scheduled / geo) */}
      {(scheduled || geoLimited) && (
        <div className="lmc-pills">
          {scheduled && (
            <span
              className="lmc-badge sky"
              title={`Starts ${new Date(scheduled).toLocaleString()}`}
            >
              <CalendarClock size={11} /> Scheduled
            </span>
          )}
          {geoLimited && (
            <span
              className="lmc-badge violet"
              title={`Restricted: ${geoLimited.join(", ")}`}
            >
              <Globe2 size={11} />{" "}
              {geoLimited.length === 1
                ? geoLimited[0]
                : `${geoLimited.length} regions`}
            </span>
          )}
        </div>
      )}

      {/* Bottom: status + clicks + trend */}
      <div className="lmc-foot">
        <span className="lmc-status">
          <StatusDot status={link.status} /> {statusLabel}
        </span>
        <span className="lmc-clicks">
          <strong>{link._count.clicks.toLocaleString()}</strong>{" "}
          <span style={{ color: "var(--ink-500)" }}>clicks</span>
          {hasTrend && (
            <span
              className={`lmc-trend ${trendPct! > 0 ? "pos" : "neg"}`}
              title="vs previous 7 days"
            >
              {trendPct! > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {Math.abs(trendPct!)}%
            </span>
          )}
        </span>
      </div>

      {/* Action menu (portal-ish — fixed positioned) */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div
            className="fixed z-50 bg-white rounded-lg shadow-lg border border-slate-200 py-1"
            style={{ top: menuPos.top, left: menuPos.left, width: 200 }}
          >
            <Link
              href={`/links/${link.id}`}
              className="lmc-menu-item"
              onClick={() => setShowMenu(false)}
            >
              <Edit size={14} /> {t("editLink")}
            </Link>
            <Link
              href={`/analytics?linkId=${link.id}`}
              className="lmc-menu-item"
              onClick={() => setShowMenu(false)}
            >
              <BarChart3 size={14} /> {t("menuAnalytics")}
            </Link>
            <Link
              href={`/links/${link.id}#qr`}
              className="lmc-menu-item"
              onClick={() => setShowMenu(false)}
            >
              <QrCode size={14} /> {t("qrCode")}
            </Link>
            <a
              href={shortUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="lmc-menu-item"
              onClick={() => setShowMenu(false)}
            >
              <ExternalLink size={14} /> Open
            </a>
            <button onClick={handleClone} className="lmc-menu-item">
              <CopyPlus size={14} /> {t("clone")}
            </button>
            <button onClick={toggleStatus} className="lmc-menu-item">
              {link.status === "ACTIVE" ? (
                <>
                  <Pause size={14} /> {t("menuPause")}
                </>
              ) : (
                <>
                  <Play size={14} /> {t("menuActivate")}
                </>
              )}
            </button>
            <hr className="my-1 border-slate-100" />
            <button onClick={handleDelete} className="lmc-menu-item danger">
              <Trash2 size={14} /> {t("menuDelete")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
