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
} from "lucide-react";
import Link from "next/link";

interface LinkCardProps {
  link: {
    id: string;
    code: string;
    originalUrl: string;
    title?: string | null;
    status: string;
    createdAt: string;
    _count: { clicks: number };
  };
  shortBaseUrl: string;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: string) => void;
}

export function LinkCard({
  link,
  shortBaseUrl,
  onDelete,
  onStatusChange,
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

      {/* QR Code */}
      {showQR && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <QRCodeCanvas
                value={shortUrl}
                size={120}
                level="M"
                className="mx-auto"
              />
              <button
                onClick={() => {
                  const canvas = document.querySelector('canvas') as HTMLCanvasElement;
                  if (canvas) {
                    const url = canvas.toDataURL("image/png");
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `qr-${link.code}.png`;
                    a.click();
                  }
                }}
                className="mt-3 text-sm text-[#03A9F4] hover:text-[#0288D1] font-medium"
              >
                Download QR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
