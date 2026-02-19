"use client";

import { useState } from "react";
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
} from "lucide-react";
import Link from "next/link";

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
    _count: { clicks: number };
    tags?: LinkTag[];
  };
  shortBaseUrl: string;
  selected: boolean;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: string) => void;
  onClone?: (id: string) => void;
}

const statusConfig = {
  ACTIVE: { dot: "bg-emerald-500", label: "Active" },
  PAUSED: { dot: "bg-amber-500", label: "Paused" },
  ARCHIVED: { dot: "bg-slate-400", label: "Archived" },
};

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
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const shortUrl = `${shortBaseUrl}/${link.code}`;
  const status = statusConfig[link.status as keyof typeof statusConfig] || statusConfig.ARCHIVED;

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
    <>
      <tr className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
        {/* Checkbox */}
        <td className="pl-4 pr-2 py-2.5 w-10">
          <button
            onClick={() => onSelect(link.id)}
            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
              selected
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

        {/* Title / Code + Original URL */}
        <td className="py-2.5 pr-3 min-w-[200px]">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {link.title || `/${link.code}`}
            </p>
            <p className="text-xs text-slate-400 truncate max-w-[360px]">
              {link.originalUrl}
            </p>
          </div>
        </td>

        {/* Short URL + Copy */}
        <td className="py-2.5 pr-3 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <code className="text-sm text-[#03A9F4] font-medium">/{link.code}</code>
            <button
              onClick={copyToClipboard}
              className="p-1 rounded hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100"
              title={t("copyLink")}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
          </div>
        </td>

        {/* Tags */}
        <td className="py-2.5 pr-3">
          {link.tags && link.tags.length > 0 && (
            <div className="flex items-center gap-1">
              {link.tags.slice(0, 2).map(({ tag }) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 max-w-[80px] truncate"
                  style={tag.color ? { backgroundColor: tag.color + "20", color: tag.color } : undefined}
                >
                  {tag.name}
                </span>
              ))}
              {link.tags.length > 2 && (
                <span className="text-xs text-slate-400">+{link.tags.length - 2}</span>
              )}
            </div>
          )}
        </td>

        {/* Status */}
        <td className="py-2.5 pr-3 whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </td>

        {/* Clicks */}
        <td className="py-2.5 pr-3 text-right whitespace-nowrap">
          <span className="text-sm font-medium text-slate-900 tabular-nums">
            {link._count.clicks.toLocaleString()}
          </span>
        </td>

        {/* Created */}
        <td className="py-2.5 pr-3 text-right whitespace-nowrap">
          <span className="text-xs text-slate-400 tabular-nums">
            {new Date(link.createdAt).toLocaleDateString()}
          </span>
        </td>

        {/* Actions */}
        <td className="py-2.5 pr-4 text-right w-10">
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-md hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
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
                    onClick={() => { setShowQR(!showQR); setShowMenu(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <QrCode className="w-4 h-4" />
                    QR Code
                  </button>
                  <button
                    onClick={() => { onClone?.(link.id); setShowMenu(false); }}
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
                      <><Pause className="w-4 h-4" /> Pause</>
                    ) : (
                      <><Play className="w-4 h-4" /> Activate</>
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
        </td>
      </tr>

      {/* QR Code expandable row */}
      {showQR && (
        <tr className="border-b border-slate-50 bg-slate-50/30">
          <td colSpan={8} className="px-4 py-4">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-white rounded-lg border border-slate-200">
                <QRCodeCanvas
                  id={`qr-${link.id}`}
                  value={shortUrl}
                  size={120}
                  level="H"
                  fgColor="#0F172A"
                  bgColor="#FFFFFF"
                  marginSize={2}
                  imageSettings={{
                    src: "/icon.svg",
                    x: undefined,
                    y: undefined,
                    height: 24,
                    width: 24,
                    excavate: true,
                  }}
                />
              </div>
              <div className="flex items-center gap-3 text-sm">
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
                  className="text-[#03A9F4] hover:text-[#0288D1] font-medium"
                >
                  Download PNG
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={() => {
                    const canvas = document.getElementById(`qr-${link.id}`) as HTMLCanvasElement;
                    if (canvas) {
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
                  }}
                  className="text-[#03A9F4] hover:text-[#0288D1] font-medium"
                >
                  Download SVG
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
