"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { UTMBuilder } from "./UTMBuilder";
import { Link2, ChevronDown, ChevronUp, Loader2, Settings2, Target, AlertCircle, CheckCircle, Megaphone } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  displayName: string | null;
  status: string;
  defaultSource: string | null;
  defaultMedium: string | null;
}

interface FormData {
  originalUrl: string;
  customCode: string;
  title: string;
  redirectType: "PERMANENT" | "TEMPORARY";
  expiresAt: string;
  maxClicks: string;
  campaignId: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
}

const initialFormData: FormData = {
  originalUrl: "",
  customCode: "",
  title: "",
  redirectType: "TEMPORARY",
  expiresAt: "",
  maxClicks: "",
  campaignId: "",
  utmSource: "",
  utmMedium: "",
  utmCampaign: "",
  utmContent: "",
  utmTerm: "",
};

export function CreateLinkForm() {
  const router = useRouter();
  const t = useTranslations("links");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const tCampaigns = useTranslations("campaigns");

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showUTM, setShowUTM] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Campaign state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  // Fetch campaigns on mount
  useEffect(() => {
    async function fetchCampaigns() {
      try {
        const response = await fetch("/api/campaigns?status=ACTIVE");
        if (response.ok) {
          const data = await response.json();
          setCampaigns(data.campaigns || []);
        }
      } catch (err) {
        console.error("Failed to fetch campaigns:", err);
      } finally {
        setLoadingCampaigns(false);
      }
    }
    fetchCampaigns();
  }, []);

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleCampaignChange = (campaignId: string) => {
    const campaign = campaigns.find((c) => c.id === campaignId);
    if (campaign) {
      setFormData((prev) => ({
        ...prev,
        campaignId,
        utmCampaign: campaign.name,
        utmSource: campaign.defaultSource || prev.utmSource,
        utmMedium: campaign.defaultMedium || prev.utmMedium,
      }));
      // Auto-expand UTM section when campaign is selected
      if (!showUTM) setShowUTM(true);
    } else {
      setFormData((prev) => ({
        ...prev,
        campaignId: "",
      }));
    }
  };

  const handleUTMChange = (utmValues: {
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
    utmContent: string;
    utmTerm: string;
  }) => {
    setFormData((prev) => ({ ...prev, ...utmValues }));
  };

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate URL
    if (!formData.originalUrl) {
      setError(tErrors("required"));
      return;
    }

    if (!validateUrl(formData.originalUrl)) {
      setError(tErrors("invalidUrl"));
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        originalUrl: formData.originalUrl,
        customCode: formData.customCode || undefined,
        title: formData.title || undefined,
        redirectType: formData.redirectType,
        expiresAt: formData.expiresAt || undefined,
        maxClicks: formData.maxClicks ? parseInt(formData.maxClicks) : undefined,
        campaignId: formData.campaignId || undefined,
        utmSource: formData.utmSource || undefined,
        utmMedium: formData.utmMedium || undefined,
        utmCampaign: formData.utmCampaign || undefined,
        utmContent: formData.utmContent || undefined,
        utmTerm: formData.utmTerm || undefined,
      };

      const response = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create link");
      }

      router.push("/links");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create link");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Original URL */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          {t("originalUrl")} <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Link2 className="w-5 h-5 text-white" />
          </div>
          <input
            type="url"
            value={formData.originalUrl}
            onChange={(e) => handleChange("originalUrl", e.target.value)}
            placeholder="https://example.com/your-long-url"
            className="w-full pl-18 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 focus:bg-white transition-all duration-200 placeholder:text-slate-400"
            style={{ paddingLeft: "4.5rem" }}
            required
          />
        </div>
      </div>

      {/* Custom Code */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          {t("customCode")}
        </label>
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-sm bg-slate-100 px-3 py-2 rounded-lg whitespace-nowrap">
            {process.env.NEXT_PUBLIC_SHORT_URL || "domain.com"}/s/
          </span>
          <input
            type="text"
            value={formData.customCode}
            onChange={(e) => handleChange("customCode", e.target.value)}
            placeholder={t("customCodePlaceholder")}
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 focus:bg-white transition-all duration-200 placeholder:text-slate-400"
            pattern="^[a-zA-Z0-9_-]{3,50}$"
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Leave empty for auto-generated code
        </p>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Title
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => handleChange("title", e.target.value)}
          placeholder="Optional title for this link"
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 focus:bg-white transition-all duration-200 placeholder:text-slate-400"
        />
      </div>

      {/* Campaign Selector */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <span className="font-semibold text-slate-700 block">{tCampaigns("title")}</span>
              <span className="text-xs text-slate-500">{tCampaigns("linkToCampaign")}</span>
            </div>
          </div>

          {loadingCampaigns ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : campaigns.length > 0 ? (
            <>
              <div className="relative">
                <select
                  value={formData.campaignId}
                  onChange={(e) => handleCampaignChange(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 appearance-none bg-white text-slate-700"
                >
                  <option value="">{tCampaigns("noCampaign")}</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.displayName || campaign.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
              {formData.campaignId && (
                <p className="mt-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                  utm_campaign will be set to: <span className="font-mono font-medium">{formData.utmCampaign}</span>
                </p>
              )}
            </>
          ) : (
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm text-slate-600 mb-2">{tCampaigns("emptyState.title")}</p>
              <p className="text-xs text-slate-500 mb-3">{tCampaigns("emptyState.description")}</p>
              <a
                href="/campaigns"
                className="inline-flex items-center gap-2 text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
              >
                <span>+ {tCampaigns("emptyState.createFirst")}</span>
              </a>
            </div>
          )}
        </div>
      </div>

      {/* UTM Builder Toggle */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <button
          type="button"
          onClick={() => setShowUTM(!showUTM)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <span className="font-semibold text-slate-700 block">UTM Parameters</span>
              <span className="text-xs text-slate-500">Add tracking parameters to your link</span>
            </div>
          </div>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${showUTM ? "bg-purple-100" : "bg-slate-100"}`}>
            {showUTM ? (
              <ChevronUp className="w-5 h-5 text-purple-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-500" />
            )}
          </div>
        </button>
        {showUTM && (
          <div className="p-5 border-t border-slate-200 bg-slate-50/50">
            <UTMBuilder
              values={{
                utmSource: formData.utmSource,
                utmMedium: formData.utmMedium,
                utmCampaign: formData.utmCampaign,
                utmContent: formData.utmContent,
                utmTerm: formData.utmTerm,
              }}
              onChange={handleUTMChange}
              originalUrl={formData.originalUrl}
            />
          </div>
        )}
      </div>

      {/* Advanced Options Toggle */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-800 rounded-lg flex items-center justify-center">
              <Settings2 className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <span className="font-semibold text-slate-700 block">Advanced Options</span>
              <span className="text-xs text-slate-500">Redirect type, expiration, click limits</span>
            </div>
          </div>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${showAdvanced ? "bg-slate-200" : "bg-slate-100"}`}>
            {showAdvanced ? (
              <ChevronUp className="w-5 h-5 text-slate-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-500" />
            )}
          </div>
        </button>
        {showAdvanced && (
          <div className="p-5 border-t border-slate-200 bg-slate-50/50 space-y-5">
            {/* Redirect Type */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                {t("redirectType")}
              </label>
              <div className="flex gap-3">
                <label className={`flex-1 flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 ${
                  formData.redirectType === "TEMPORARY"
                    ? "border-violet-500 bg-violet-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}>
                  <input
                    type="radio"
                    name="redirectType"
                    value="TEMPORARY"
                    checked={formData.redirectType === "TEMPORARY"}
                    onChange={(e) => handleChange("redirectType", e.target.value as "TEMPORARY")}
                    className="w-4 h-4 text-violet-600"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700 block">{t("temporary")}</span>
                    <span className="text-xs text-slate-500">302 redirect</span>
                  </div>
                  {formData.redirectType === "TEMPORARY" && (
                    <CheckCircle className="w-5 h-5 text-violet-500 ml-auto" />
                  )}
                </label>
                <label className={`flex-1 flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 ${
                  formData.redirectType === "PERMANENT"
                    ? "border-violet-500 bg-violet-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}>
                  <input
                    type="radio"
                    name="redirectType"
                    value="PERMANENT"
                    checked={formData.redirectType === "PERMANENT"}
                    onChange={(e) => handleChange("redirectType", e.target.value as "PERMANENT")}
                    className="w-4 h-4 text-violet-600"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700 block">{t("permanent")}</span>
                    <span className="text-xs text-slate-500">301 redirect</span>
                  </div>
                  {formData.redirectType === "PERMANENT" && (
                    <CheckCircle className="w-5 h-5 text-violet-500 ml-auto" />
                  )}
                </label>
              </div>
            </div>

            {/* Expiration */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                {t("expiresAt")}
              </label>
              <input
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(e) => handleChange("expiresAt", e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all duration-200"
              />
              <p className="mt-2 text-xs text-slate-500">{t("noExpiry")}</p>
            </div>

            {/* Max Clicks */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                {t("maxClicks")}
              </label>
              <input
                type="number"
                min="1"
                value={formData.maxClicks}
                onChange={(e) => handleChange("maxClicks", e.target.value)}
                placeholder={t("noLimit")}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all duration-200 placeholder:text-slate-400"
              />
            </div>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex gap-4 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all duration-200 font-medium"
        >
          {tCommon("cancel")}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg shadow-emerald-500/25"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              {t("createNew")}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
