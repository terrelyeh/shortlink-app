"use client";

import { useTranslations } from "next-intl";
import { QRCodeCanvas } from "qrcode.react";
import { Download } from "lucide-react";

interface QrCodePanelProps {
  /** Unique per link — used as the canvas element id for downloads. */
  linkId: string;
  code: string;
  shortUrl: string;
  size?: number;
}

/**
 * QR code for a short link + PNG/SVG download. Shared by the desktop
 * table row (expand-below-row) and the mobile card (inline), so both
 * surfaces offer the same thing.
 */
export function QrCodePanel({ linkId, code, shortUrl, size = 96 }: QrCodePanelProps) {
  const t = useTranslations("links");
  const canvasId = `qr-${linkId}`;

  const download = (format: "png" | "svg") => {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    if (format === "png") {
      a.href = dataUrl;
      a.download = `qr-${code}.png`;
      a.click();
      return;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="white"/><image href="${dataUrl}" width="200" height="200"/></svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    a.href = url;
    a.download = `qr-${code}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="p-2 bg-white rounded-lg border border-slate-200">
        <QRCodeCanvas
          id={canvasId}
          value={shortUrl}
          size={size}
          level="H"
          fgColor="#0F172A"
          bgColor="#FFFFFF"
          marginSize={2}
          imageSettings={{
            src: "/icon.svg",
            x: undefined,
            y: undefined,
            height: Math.round(size * 0.21),
            width: Math.round(size * 0.21),
            excavate: true,
          }}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => download("png")}
          className="inline-flex items-center gap-1.5 text-sm text-[#03A9F4] hover:text-[#0288D1] font-medium"
        >
          <Download className="w-3.5 h-3.5" />
          {t("downloadPng")}
        </button>
        <span className="text-slate-300">|</span>
        <button
          type="button"
          onClick={() => download("svg")}
          className="inline-flex items-center gap-1.5 text-sm text-[#03A9F4] hover:text-[#0288D1] font-medium"
        >
          <Download className="w-3.5 h-3.5" />
          {t("downloadSvg")}
        </button>
      </div>
    </div>
  );
}
