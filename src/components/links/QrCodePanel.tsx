"use client";

import { useTranslations } from "next-intl";
import { QRCodeCanvas } from "qrcode.react";
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { downloadBlob, qrFilename, qrPngBlob, qrSvgBlob } from "@/lib/qr-export";

interface QrCodePanelProps {
  /** Unique per link — used as the canvas element id for downloads. */
  linkId: string;
  code: string;
  shortUrl: string;
  /** Used for the download filename (falls back to the code). */
  title?: string | null;
  size?: number;
}

/**
 * QR code for a short link + print-quality PNG (1024 px) / vector SVG download. Shared by the desktop
 * table row (expand-below-row) and the mobile card (inline), so both
 * surfaces offer the same thing.
 */
export function QrCodePanel({ linkId, code, shortUrl, title, size = 96 }: QrCodePanelProps) {
  const t = useTranslations("links");
  const canvasId = `qr-${linkId}`; // preview only

  const [busy, setBusy] = useState<"png" | "svg" | null>(null);

  // Downloads are rendered fresh at print resolution (see lib/qr-export),
  // not copied from the small preview canvas.
  const download = async (format: "png" | "svg") => {
    setBusy(format);
    try {
      const blob = format === "png" ? await qrPngBlob(shortUrl) : await qrSvgBlob(shortUrl);
      downloadBlob(blob, qrFilename(title, code, format));
    } finally {
      setBusy(null);
    }
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
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 text-sm text-[#03A9F4] hover:text-[#0288D1] font-medium"
        >
          {busy === "png" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {t("downloadPng")}
        </button>
        <span className="text-slate-300">|</span>
        <button
          type="button"
          onClick={() => download("svg")}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 text-sm text-[#03A9F4] hover:text-[#0288D1] font-medium"
        >
          {busy === "svg" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {t("downloadSvg")}
        </button>
      </div>
    </div>
  );
}
