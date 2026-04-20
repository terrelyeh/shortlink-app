"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { QRCodeCanvas } from "qrcode.react";
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
  Download,
  CalendarClock,
  Globe2,
} from "lucide-react";
import Link from "next/link";
import { Badge, StatusDot } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

interface LinkTag {
  tag: { id: string; name: string; color?: string | null };
}

interface LinkTableRowProps {
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

export function LinkTableRow({
  link,
  shortBaseUrl,
  selected,
  onSelect,
  onDelete,
  onStatusChange,
  onClone,
}: LinkTableRowProps) {
  const t = useTranslations("links");
  const { success } = useToast();
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (showMenu && menuBtnRef.current) {
      const rect = menuBtnRef.current.getBoundingClientRect();
      const menuWidth = 176;
      const menuHeight = 260;
      const spaceBelow = window.innerHeight - rect.bottom;
      setMenuPos({
        top: spaceBelow < menuHeight ? rect.top - menuHeight : rect.bottom + 4,
        left: rect.right - menuWidth,
      });
    }
  }, [showMenu]);

  const shortUrl = `${shortBaseUrl}/${link.code}`;
  const statusLabel =
    link.status === "ACTIVE" ? t("active") : link.status === "PAUSED" ? t("paused") : t("archived");

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    success(t("copySuccess") || "Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = () => {
    // Delegate to parent which handles the ConfirmDialog
    onDelete?.(link.id);
    setShowMenu(false);
  };

  const toggleStatus = async () => {
    const newStatus = link.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    onStatusChange?.(link.id, newStatus);
    setShowMenu(false);
  };

  const handleClone = () => {
    onClone?.(link.id);
    setShowMenu(false);
  };

  const downloadQR = (format: "png" | "svg") => {
    const canvas = document.getElementById(`qr-${link.id}`) as HTMLCanvasElement;
    if (!canvas) return;
    if (format === "png") {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-${link.code}.png`;
      a.click();
    } else {
      const dataUrl = canvas.toDataURL("image/png");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="white"/><image href="${dataUrl}" width="200" height="200"/></svg>`;
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-${link.code}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Trend display
  const trendPct = link.trendPct ?? null;
  const hasTrend = trendPct !== null;

  return (
    <>
      <tr className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
        {/* Checkbox */}
        <td className="pl-4 pr-2 py-2 w-8">
          <button
            onClick={() => onSelect(link.id)}
            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${selected
                ? "bg-[#03A9F4] border-[#03A9F4] text-white"
                : "border-slate-300 hover:border-slate-400"
              }`}
          >
            {selected && (
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        </td>

        {/* Title + Original URL + OG thumbnail */}
        <td className="py-2 pr-3 min-w-[160px] max-w-[220px]">
          <div className="flex items-start gap-2 min-w-0">
            {/* OG image thumbnail — falls back to a letter avatar when
                the scrape failed / hasn't run yet. Plain <img> (not
                next/image) avoids needing every destination domain in
                next.config's remotePatterns list. */}
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
                className="w-10 h-10 rounded-md object-cover bg-slate-100 border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-md bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 shrink-0 flex items-center justify-center text-xs font-semibold text-slate-400">
                {(link.title || link.code).charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 truncate" title={link.ogTitle ?? undefined}>
                {link.title || `/${link.code}`}
              </p>
              <p className="text-[11px] text-slate-400 truncate" title={link.originalUrl}>
                {link.originalUrl.replace(/^https?:\/\/(www\.)?/, "").substring(0, 50)}
              </p>
              {/* Schedule / geo indicators — these affect whether the link
                  actually redirects, so worth surfacing at a glance. */}
              {(link.startsAt || (link.allowedCountries && link.allowedCountries.length > 0)) && (
                <div className="flex items-center gap-2 mt-1">
                  {link.startsAt && new Date(link.startsAt) > new Date() && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-100"
                      title={`Starts ${new Date(link.startsAt).toLocaleString()}`}
                    >
                      <CalendarClock className="w-2.5 h-2.5" />
                      Scheduled
                    </span>
                  )}
                  {link.allowedCountries && link.allowedCountries.length > 0 && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-100"
                      title={`Restricted to: ${link.allowedCountries.join(", ")}`}
                    >
                      <Globe2 className="w-2.5 h-2.5" />
                      {link.allowedCountries.length === 1
                        ? link.allowedCountries[0]
                        : `${link.allowedCountries.length} regions`}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </td>

        {/* Campaign */}
        <td className="py-2.5 pr-3 max-w-[120px]">
          {link.utmCampaign ? (
            <Badge label={link.utmCampaign} variant="campaign" />
          ) : (
            <span className="text-[11px] text-slate-300">—</span>
          )}
        </td>

        {/* Medium */}
        <td className="py-2.5 pr-3">
          {link.utmMedium ? (
            <span className="pill pill-medium">{link.utmMedium}</span>
          ) : (
            <span className="text-[11px] text-slate-300">—</span>
          )}
        </td>

        {/* Source */}
        <td className="py-2.5 pr-3">
          {link.utmSource ? (
            <span className="pill pill-source">{link.utmSource}</span>
          ) : (
            <span className="text-[11px] text-slate-300">—</span>
          )}
        </td>

        {/* Short URL + Copy */}
        <td className="py-2 pr-3 whitespace-nowrap">
          <div className="flex items-center gap-1">
            <code className="text-[11px] text-[#03A9F4] font-medium">/{link.code}</code>
            <button
              onClick={copyToClipboard}
              className="p-1 rounded hover:bg-slate-100 transition-colors"
              title={t("copyLink")}
            >
              {copied ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <Copy className="w-3 h-3 text-slate-400" />
              )}
            </button>
          </div>
        </td>

        {/* Tags */}
        <td className="py-2 pr-3 max-w-[100px]">
          {link.tags && link.tags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {link.tags.slice(0, 2).map(({ tag }) => (
                <Badge key={tag.id} label={tag.name} variant="tag" color={tag.color} />
              ))}
              {link.tags.length > 2 && (
                <span className="text-[10px] text-slate-400">+{link.tags.length - 2}</span>
              )}
            </div>
          )}
        </td>

        {/* Status */}
        <td className="py-2 pr-3 whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <StatusDot status={link.status} />
            {statusLabel}
          </span>
        </td>

        {/* Clicks + 7d trend */}
        <td className="py-2 pr-3 text-right whitespace-nowrap">
          <span className="text-sm font-medium text-slate-900 tabular-nums">
            {link._count.clicks.toLocaleString()}
          </span>
          {hasTrend && trendPct !== 0 && (
            <div className={`flex items-center justify-end gap-0.5 text-[10px] font-medium ${trendPct! > 0 ? "text-emerald-600" : "text-red-500"}`}>
              {trendPct! > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(trendPct!)}%
            </div>
          )}
        </td>

        {/* Actions */}
        <td className="py-2 pr-3 text-right w-10">
          <button
            ref={menuBtnRef}
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded-md hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div
                className="fixed w-44 bg-white rounded-lg shadow-lg border border-slate-200 z-50 py-1"
                style={{ top: menuPos.top, left: menuPos.left }}
              >
                <Link
                  href={`/links/${link.id}`}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setShowMenu(false)}
                >
                  <Edit className="w-3.5 h-3.5" />
                  {t("editLink")}
                </Link>
                <Link
                  href={`/analytics?linkId=${link.id}`}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setShowMenu(false)}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  {t("menuAnalytics")}
                </Link>
                <button
                  onClick={() => { setShowQR(!showQR); setShowMenu(false); }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  {t("qrCode")}
                </button>
                <button
                  onClick={handleClone}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <CopyPlus className="w-3.5 h-3.5" />
                  {t("clone")}
                </button>
                <button
                  onClick={toggleStatus}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  {link.status === "ACTIVE" ? (
                    <><Pause className="w-3.5 h-3.5" /> {t("menuPause")}</>
                  ) : (
                    <><Play className="w-3.5 h-3.5" /> {t("menuActivate")}</>
                  )}
                </button>
                <hr className="my-1 border-slate-100" />
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t("menuDelete")}
                </button>
              </div>
            </>
          )}
        </td>
      </tr>

      {/* QR Code expandable row */}
      {showQR && (
        <tr className="border-b border-slate-50 bg-slate-50/30">
          <td colSpan={11} className="px-4 py-4">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-white rounded-lg border border-slate-200">
                <QRCodeCanvas
                  id={`qr-${link.id}`}
                  value={shortUrl}
                  size={96}
                  level="H"
                  fgColor="#0F172A"
                  bgColor="#FFFFFF"
                  marginSize={2}
                  imageSettings={{
                    src: "/icon.svg",
                    x: undefined,
                    y: undefined,
                    height: 20,
                    width: 20,
                    excavate: true,
                  }}
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => downloadQR("png")}
                  className="inline-flex items-center gap-1.5 text-sm text-[#03A9F4] hover:text-[#0288D1] font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  {t("downloadPng")}
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={() => downloadQR("svg")}
                  className="inline-flex items-center gap-1.5 text-sm text-[#03A9F4] hover:text-[#0288D1] font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  {t("downloadSvg")}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
