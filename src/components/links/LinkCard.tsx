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

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title or Short URL */}
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 truncate">
              {link.title || `/${link.code}`}
            </h3>
            {link.status !== "ACTIVE" && (
              <span
                className={`px-2 py-0.5 text-xs rounded-full ${
                  link.status === "PAUSED"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {link.status.toLowerCase()}
              </span>
            )}
          </div>

          {/* Short URL */}
          <div className="flex items-center gap-2 mt-1">
            <a
              href={shortUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              {shortUrl}
            </a>
            <button
              onClick={copyToClipboard}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title={t("copyLink")}
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>

          {/* Original URL */}
          <p className="text-sm text-gray-500 truncate mt-1">
            {link.originalUrl}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              {link._count.clicks.toLocaleString()} {t("clicks")}
            </span>
            <span>
              {new Date(link.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQR(!showQR)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={t("qrCode")}
          >
            <QrCode className="w-5 h-5 text-gray-500" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MoreVertical className="w-5 h-5 text-gray-500" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                  <Link
                    href={`/links/${link.id}`}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowMenu(false)}
                  >
                    <Edit className="w-4 h-4" />
                    {t("edit")}
                  </Link>
                  <Link
                    href={`/analytics?linkId=${link.id}`}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowMenu(false)}
                  >
                    <BarChart3 className="w-4 h-4" />
                    View Analytics
                  </Link>
                  <button
                    onClick={toggleStatus}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
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
                  <hr className="my-1" />
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t("delete")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* QR Code */}
      {showQR && (
        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-center">
          <div className="text-center">
            <QRCodeCanvas value={shortUrl} size={150} level="M" />
            <button
              onClick={() => {
                const canvas = document.querySelector(
                  `[data-qr-id="${link.id}"]`
                ) as HTMLCanvasElement;
                if (canvas) {
                  const url = canvas.toDataURL("image/png");
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `qr-${link.code}.png`;
                  a.click();
                }
              }}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700"
            >
              {t("downloadQR")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
