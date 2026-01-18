"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Copy, Check } from "lucide-react";
import { useTranslations } from "next-intl";

interface QRCodeGeneratorProps {
  url: string;
  size?: number;
  title?: string;
}

export function QRCodeGenerator({ url, size = 200, title }: QRCodeGeneratorProps) {
  const t = useTranslations("links");
  const canvasRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const downloadQRCode = (format: "png" | "svg") => {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;

    if (format === "png") {
      const link = document.createElement("a");
      link.download = `qrcode-${title || "link"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } else {
      // For SVG, we need to recreate it
      const svgData = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml">
              ${canvas.outerHTML}
            </div>
          </foreignObject>
        </svg>
      `;
      const blob = new Blob([svgData], { type: "image/svg+xml" });
      const link = document.createElement("a");
      link.download = `qrcode-${title || "link"}.svg`;
      link.href = URL.createObjectURL(blob);
      link.click();
    }
  };

  const copyToClipboard = async () => {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;

    try {
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
        }, "image/png");
      });

      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={canvasRef}
        className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm"
      >
        <QRCodeCanvas
          value={url}
          size={size}
          level="H"
          includeMargin
          imageSettings={{
            src: "/favicon.ico",
            height: 24,
            width: 24,
            excavate: true,
          }}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => downloadQRCode("png")}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          PNG
        </button>
        <button
          onClick={copyToClipboard}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-green-600" />
              {t("copied")}
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy
            </>
          )}
        </button>
      </div>

      <p className="text-xs text-gray-500 text-center break-all max-w-[200px]">
        {url}
      </p>
    </div>
  );
}
