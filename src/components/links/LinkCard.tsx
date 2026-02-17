"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { QRCodeCanvas } from "qrcode.react";
import {
  Copy,
  Check,
  ExternalLink,
  MoreVertical,
  Edit,
  Trash2,
  QrCode,
  BarChart3,
  Pause,
  Play,
  MousePointerClick,
  Calendar,
  CopyPlus,
} from "lucide-react";
import Link from "next/link";

interface LinkTag {
  tag: { id: string; name: string; color?: string | null };
}

interface LinkCardProps {
  link: {
    id: string;
    code: string;
    originalUrl: string;
    title?: string | null;
    status: string;
    createdAt: string;
    _count: { clicks: number };
    tags?: LinkTag[];
  };
  shortBaseUrl: string;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: string) => void;
  onClone?: (id: string) => void;
}

export function LinkCard({
  link,
  shortBaseUrl,
  onDelete,
  onStatusChange,
  onClone,
}: LinkCardProps) {
  const t = useTranslations("links");
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const shortUrl = `${shortBaseUrl}/${link.code}`;

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = () => {
    if (confirm(t("deleteConfirm"))) {
      onDelete?.(link.id);
    }
    setShowMenu(false);
  };

  const toggleStatus = () => {
    const newStatus = link.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    onStatusChange?.(link.id, newStatus);
    setShowMenu(false);
  };

  const statusConfig = {
    ACTIVE: { dot: "bg-emerald-500", text: "text-emerald-600" },
    PAUSED: { dot: "bg-amber-500", text: "text-amber-600" },
    ARCHIVED: { dot: "bg-slate-400", text: "text-slate-500" },
  };

  const status = statusConfig[link.status as keyof typeof statusConfig] || statusConfig.ARCHIVED;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title and Status */}
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-medium text-slate-900 truncate">
              {link.title || `/${link.code}`}
            </h3>
            <span className={`inline-flex items-center gap-1.5 text-xs ${status.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {link.status.charAt(0) + link.status.slice(1).toLowerCase()}
            </span>
          </div>

          {/* Short URL with copy */}
          <div className="flex items-center gap-2 mb-2">
            <code className="text-sm text-[#03A9F4] font-medium">
              {shortUrl.replace('https://', '').replace('http://', '')}
            </code>
            <button
              onClick={copyToClipboard}
              className="p-1 hover:bg-slate-100 rounded transition-colors"
              title={t("copyLink")}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
              )}
            </button>
            {copied && (
              <span className="text-xs text-emerald-600">Copied!</span>
            )}
          </div>

          {/* Original URL */}
          <p className="text-sm text-slate-500 truncate mb-3 flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
            {link.originalUrl}
          </p>

          {/* Tags */}
          {link.tags && link.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {link.tags.map(({ tag }) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600"
                  style={tag.color ? { backgroundColor: tag.color + "20", color: tag.color } : undefined}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <MousePointerClick className="w-4 h-4" />
              {link._count.clicks.toLocaleString()} clicks
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {new Date(link.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowQR(!showQR)}
            className={`p-2 rounded-lg transition-colors ${
              showQR
                ? 'bg-sky-50 text-[#03A9F4]'
                : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
            }`}
            title={t("qrCode")}
          >
            <QrCode className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-slate-200 z-20 py-1">
                  <Link
                    href={`/links/${link.id}`}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => setShowMenu(false)}
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </Link>
                  <Link
                    href={`/analytics?linkId=${link.id}`}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => setShowMenu(false)}
                  >
                    <BarChart3 className="w-4 h-4" />
                    Analytics
                  </Link>
                  <button
                    onClick={() => {
                      onClone?.(link.id);
                      setShowMenu(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <CopyPlus className="w-4 h-4" />
                    Clone
                  </button>
                  <button
                    onClick={toggleStatus}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    {link.status === "ACTIVE" ? (
                      <>
                        <Pause className="w-4 h-4" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Activate
                      </>
                    )}
                  </button>
                  <hr className="my-1 border-slate-100" />
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* QR Code (branded) */}
      {showQR && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
              <QRCodeCanvas
                id={`qr-${link.id}`}
                value={shortUrl}
                size={160}
                level="H"
                fgColor="#0F172A"
                bgColor="#FFFFFF"
                marginSize={2}
                imageSettings={{
                  src: "/icon.svg",
                  x: undefined,
                  y: undefined,
                  height: 32,
                  width: 32,
                  excavate: true,
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const canvas = document.getElementById(`qr-${link.id}`) as HTMLCanvasElement;
                  if (canvas) {
                    const url = canvas.toDataURL("image/png");
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `qr-${link.code}.png`;
                    a.click();
                  }
                }}
                className="text-sm text-[#03A9F4] hover:text-[#0288D1] font-medium"
              >
                PNG
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={() => {
                  const canvas = document.getElementById(`qr-${link.id}`) as HTMLCanvasElement;
                  if (canvas) {
                    // Create SVG wrapper with white background
                    const dataUrl = canvas.toDataURL("image/png");
                    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
                      <rect width="200" height="200" fill="white"/>
                      <image href="${dataUrl}" width="200" height="200"/>
                    </svg>`;
                    const blob = new Blob([svg], { type: "image/svg+xml" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `qr-${link.code}.svg`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }
                }}
                className="text-sm text-[#03A9F4] hover:text-[#0288D1] font-medium"
              >
                SVG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
