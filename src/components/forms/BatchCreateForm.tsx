"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { UTM_SOURCES, UTM_MEDIUMS } from "@/lib/utils/utm";
import { Loader2, Download, Check, Copy, ChevronDown } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

interface CreatedLink {
  id: string;
  code: string;
  originalUrl: string;
  shortUrl: string;
  title: string;
}

export function BatchCreateForm() {
  const t = useTranslations("utm");
  const tLinks = useTranslations("links");

  const [originalUrl, setOriginalUrl] = useState("");
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [contents, setContents] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdLinks, setCreatedLinks] = useState<CreatedLink[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const contentList = contents
      .split("\n")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (contentList.length === 0) {
      setError("Please enter at least one content value");
      return;
    }

    if (contentList.length > 100) {
      setError("Maximum 100 items allowed per batch");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/links/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalUrl,
          utmSource: utmSource || undefined,
          utmMedium: utmMedium || undefined,
          utmCampaign: utmCampaign || undefined,
          contents: contentList,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create links");
      }

      setCreatedLinks(data.links);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create links");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadCSV = () => {
    const headers = ["Title", "Short URL", "Original URL", "Code"];
    const rows = createdLinks.map((link) => [
      link.title,
      link.shortUrl,
      link.originalUrl,
      link.code,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `batch-links-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const downloadAllQRCodes = () => {
    createdLinks.forEach((link, index) => {
      setTimeout(() => {
        const canvas = document.getElementById(`qr-${link.id}`) as HTMLCanvasElement;
        if (canvas) {
          const url = canvas.toDataURL("image/png");
          const a = document.createElement("a");
          a.href = url;
          a.download = `qr-${link.title || link.code}.png`;
          a.click();
        }
      }, index * 100);
    });
  };

  if (createdLinks.length > 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            Created {createdLinks.length} Links
          </h2>
          <div className="flex gap-2">
            <button
              onClick={downloadCSV}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
            <button
              onClick={downloadAllQRCodes}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download All QR Codes
            </button>
            <button
              onClick={() => setCreatedLinks([])}
              className="px-4 py-2 bg-[#03A9F4] text-white rounded-lg hover:bg-[#0288D1] transition-colors"
            >
              Create More
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {createdLinks.map((link) => (
            <div
              key={link.id}
              className="bg-white border border-slate-200 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-slate-900">{link.title}</h3>
                <button
                  onClick={() => copyToClipboard(link.shortUrl, link.id)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {copiedId === link.id ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-500" />
                  )}
                </button>
              </div>
              <p className="text-sm text-[#03A9F4] break-all">{link.shortUrl}</p>
              <div className="flex justify-center pt-2">
                <QRCodeCanvas
                  id={`qr-${link.id}`}
                  value={link.shortUrl}
                  size={120}
                  level="M"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Original URL */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {tLinks("originalUrl")} <span className="text-red-500">*</span>
        </label>
        <input
          type="url"
          value={originalUrl}
          onChange={(e) => setOriginalUrl(e.target.value)}
          placeholder="https://example.com/landing-page"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
          required
        />
      </div>

      {/* UTM Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t("source")}
          </label>
          <div className="relative">
            <select
              value={utmSource}
              onChange={(e) => setUtmSource(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] appearance-none bg-white"
            >
              <option value="">Select source</option>
              {UTM_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t("medium")}
          </label>
          <div className="relative">
            <select
              value={utmMedium}
              onChange={(e) => setUtmMedium(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] appearance-none bg-white"
            >
              <option value="">Select medium</option>
              {UTM_MEDIUMS.map((medium) => (
                <option key={medium} value={medium}>
                  {medium}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t("campaign")}
          </label>
          <input
            type="text"
            value={utmCampaign}
            onChange={(e) => setUtmCampaign(e.target.value)}
            placeholder={t("campaignPlaceholder")}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4]"
          />
        </div>
      </div>

      {/* Content List */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {t("content")} (utm_content) <span className="text-red-500">*</span>
        </label>
        <textarea
          value={contents}
          onChange={(e) => setContents(e.target.value)}
          placeholder="Enter one value per line, e.g.:
kol_alice
kol_bob
kol_charlie
influencer_david"
          rows={8}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] font-mono text-sm"
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          {t("batchDescription")}
        </p>
      </div>

      {/* Preview */}
      {contents && originalUrl && (
        <div className="p-4 bg-slate-50 rounded-lg">
          <h3 className="text-sm font-medium text-slate-700 mb-2">Preview</h3>
          <p className="text-sm text-slate-600">
            Will create{" "}
            <span className="font-semibold">
              {contents.split("\n").filter((c) => c.trim()).length}
            </span>{" "}
            short links
          </p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#03A9F4] text-white rounded-lg hover:bg-[#0288D1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Creating Links...
          </>
        ) : (
          t("batchCreate")
        )}
      </button>
    </form>
  );
}
