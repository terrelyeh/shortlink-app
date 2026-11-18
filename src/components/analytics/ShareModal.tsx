"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X, Link2, Copy, Check, Eye, EyeOff, Loader2, Share2, AlertCircle, CalendarRange } from "lucide-react";
import { formatSharePeriod, toShareDate } from "@/lib/share-period";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Scope selectors — omit both for a workspace-wide report. */
  linkId?: string;
  campaignFilter?: string;
  /** Human label of the link / campaign being shared (for the summary line). */
  scopeLabel?: string;
  /**
   * Period shown in the report — always frozen to the dates on screen
   * when the link is generated. ("Last 7 days" style rolling windows
   * made the numbers change every time the manager reopened the link.)
   */
  period: { start: Date; end: Date } | "all";
}

export function ShareModal({ isOpen, onClose, linkId, campaignFilter, scopeLabel, period }: ShareModalProps) {
  const t = useTranslations("share");
  const tCommon = useTranslations("common");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState("30");
  const [maxViews, setMaxViews] = useState("");
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const rangeWindow =
    period === "all" ? "all" : `${toShareDate(period.start)}..${toShareDate(period.end)}`;
  const periodLabel = formatSharePeriod(rangeWindow, t("periodAll"));
  const scopeText = linkId
    ? t("scopeLink", { name: scopeLabel ?? "" })
    : campaignFilter
      ? t("scopeCampaign", { name: campaignFilter })
      : t("scopeWorkspace");

  const handleCreate = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(expiresInDays || "30"));

      const body: Record<string, unknown> = {
        expiresAt: expiresAt.toISOString(),
        rangeWindow,
        ...(linkId && { shortLinkId: linkId }),
        ...(campaignFilter && { campaignName: campaignFilter }),
        ...(password && { password }),
        ...(maxViews && { maxViews: parseInt(maxViews) }),
      };

      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setShareUrl(`${window.location.origin}/share/${data.token}`);
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorMsg(typeof errData.error === "string" ? errData.error : t("createFailed", { status: res.status }));
      }
    } catch (err) {
      console.error("Failed to create share link:", err);
      setErrorMsg(t("networkError"));
    } finally {
      setLoading(false);
    }
  };

  const copyShareUrl = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setShareUrl(null);
    setPassword("");
    setMaxViews("");
    setExpiresInDays("30");
    setErrorMsg(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6">
        <button
          onClick={handleClose}
          aria-label={tCommon("cancel")}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-sky-50 rounded-xl flex items-center justify-center">
            <Share2 className="w-4 h-4 text-[#03A9F4]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">{t("title")}</h3>
            <p className="text-xs text-slate-500">{t("shareDescription")}</p>
          </div>
        </div>

        {!shareUrl ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 bg-sky-50 border border-sky-100 rounded-lg">
              <CalendarRange className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div className="text-xs text-sky-800 leading-relaxed">
                <div>
                  <span className="font-semibold">{scopeText}</span> · {periodLabel}
                </div>
                <div className="text-sky-700/80 mt-0.5">{t("periodFrozenHint")}</div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">{t("expiresAfter")}</label>
              <div className="flex gap-2">
                {["7", "30", "90"].map((d) => (
                  <button
                    key={d}
                    onClick={() => setExpiresInDays(d)}
                    className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors font-medium ${
                      expiresInDays === d
                        ? "bg-[#03A9F4] text-white border-[#03A9F4]"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {t("days", { n: d })}
                  </button>
                ))}
                <input
                  type="number"
                  min="1"
                  max="365"
                  placeholder={t("customDays")}
                  value={["7", "30", "90"].includes(expiresInDays) ? "" : expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                {t("passwordProtect")} <span className="text-slate-300 font-normal">({t("optional")})</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("passwordPlaceholder")}
                  className="w-full pr-10 pl-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={t("passwordProtect")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                {t("maxViews")} <span className="text-slate-300 font-normal">({t("optional")})</span>
              </label>
              <input
                type="number"
                min="1"
                value={maxViews}
                onChange={(e) => setMaxViews(e.target.value)}
                placeholder={t("unlimited")}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
              />
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 leading-relaxed">{errorMsg}</p>
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full py-2.5 bg-[#03A9F4] text-white text-sm font-medium rounded-lg hover:bg-[#0288D1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              {t("createShareLink")}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
              <p className="text-xs font-medium text-emerald-700 mb-2">{t("created")}</p>
              <div className="flex items-center gap-2 bg-white border border-emerald-200 rounded-lg px-3 py-2">
                <Link2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-xs text-slate-600 flex-1 truncate font-mono">{shareUrl}</span>
                <button
                  onClick={copyShareUrl}
                  aria-label={tCommon("copy")}
                  className="p-1 hover:bg-slate-100 rounded transition-colors shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                </button>
              </div>
            </div>
            {password && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                {t("passwordSet")}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={copyShareUrl}
                className="flex-1 py-2 text-sm font-medium bg-[#03A9F4] text-white rounded-lg hover:bg-[#0288D1] transition-colors flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? tCommon("copied") : tCommon("copy")}
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                {t("done")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
