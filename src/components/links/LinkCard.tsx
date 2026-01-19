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
  Globe,
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
    ACTIVE: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
    PAUSED: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
    ARCHIVED: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
  };

  const status = statusConfig[link.status as keyof typeof statusConfig] || statusConfig.ARCHIVED;

  return (
    <div className="group bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-lg hover:border-gray-300 transition-all duration-300">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title and Status */}
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-semibold text-gray-900 text-lg truncate">
              {link.title || `/${link.code}`}
            </h3>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${status.bg} ${status.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {link.status.charAt(0) + link.status.slice(1).toLowerCase()}
            </span>
          </div>

          {/* Short URL with copy */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
              <Globe className="w-4 h-4 text-blue-500" />
              <a
                href={shortUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                {shortUrl.replace('https://', '').replace('http://', '')}
              </a>
              <button
                onClick={copyToClipboard}
                className="p-1 hover:bg-blue-100 rounded transition-colors"
                title={t("copyLink")}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4 text-blue-400 hover:text-blue-600" />
                )}
              </button>
            </div>
            {copied && (
              <span className="text-xs text-emerald-600 font-medium animate-pulse">
                Copied!
              </span>
            )}
          </div>

          {/* Original URL */}
          <p className="text-sm text-gray-500 truncate mb-4 flex items-center gap-2">
            <ExternalLink className="w-4 h-4 flex-shrink-0" />
            {link.originalUrl}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <div className="p-1.5 bg-indigo-50 rounded-lg">
                <MousePointerClick className="w-4 h-4 text-indigo-600" />
              </div>
              <span className="font-semibold">{link._count.clicks.toLocaleString()}</span>
              <span className="text-gray-400">clicks</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <Calendar className="w-4 h-4" />
              {new Date(link.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowQR(!showQR)}
            className={`p-2.5 rounded-xl transition-all duration-200 ${
              showQR
                ? 'bg-indigo-100 text-indigo-600'
                : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'
            }`}
            title={t("qrCode")}
          >
            <QrCode className="w-5 h-5" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 z-20 py-2 overflow-hidden">
                  <Link
                    href={`/links/${link.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={() => setShowMenu(false)}
                  >
                    <Edit className="w-4 h-4" />
                    Edit Link
                  </Link>
                  <Link
                    href={`/analytics?linkId=${link.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={() => setShowMenu(false)}
                  >
                    <BarChart3 className="w-4 h-4" />
                    View Analytics
                  </Link>
                  <button
                    onClick={toggleStatus}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {link.status === "ACTIVE" ? (
                      <>
                        <Pause className="w-4 h-4" />
                        Pause Link
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Activate Link
                      </>
                    )}
                  </button>
                  <div className="my-2 border-t border-gray-100" />
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Link
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* QR Code */}
      {showQR && (
        <div className="mt-5 pt-5 border-t border-gray-100">
          <div className="flex items-center justify-center">
            <div className="text-center p-6 bg-gray-50 rounded-2xl">
              <QRCodeCanvas
                value={shortUrl}
                size={160}
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
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <QrCode className="w-4 h-4" />
                {t("downloadQR")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
