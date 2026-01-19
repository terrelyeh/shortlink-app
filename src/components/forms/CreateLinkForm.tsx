"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { UTMBuilder } from "./UTMBuilder";
import { Link2, ChevronDown, ChevronUp, Loader2, Settings2, Target, AlertCircle, CheckCircle } from "lucide-react";

interface FormData {
  originalUrl: string;
  customCode: string;
  title: string;
  redirectType: "PERMANENT" | "TEMPORARY";
  expiresAt: string;
  maxClicks: string;
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

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showUTM, setShowUTM] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
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
          <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <Link2 className="w-5 h-5 text-white" />
          </div>
          <input
            type="url"
            value={formData.originalUrl}
            onChange={(e) => handleChange("originalUrl", e.target.value)}
            placeholder="https://example.com/your-long-url"
            className="w-full pl-18 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all duration-200 placeholder:text-slate-400"
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
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all duration-200 placeholder:text-slate-400"
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
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all duration-200 placeholder:text-slate-400"
        />
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
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}>
                  <input
                    type="radio"
                    name="redirectType"
                    value="TEMPORARY"
                    checked={formData.redirectType === "TEMPORARY"}
                    onChange={(e) => handleChange("redirectType", e.target.value as "TEMPORARY")}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700 block">{t("temporary")}</span>
                    <span className="text-xs text-slate-500">302 redirect</span>
                  </div>
                  {formData.redirectType === "TEMPORARY" && (
                    <CheckCircle className="w-5 h-5 text-blue-500 ml-auto" />
                  )}
                </label>
                <label className={`flex-1 flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 ${
                  formData.redirectType === "PERMANENT"
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}>
                  <input
                    type="radio"
                    name="redirectType"
                    value="PERMANENT"
                    checked={formData.redirectType === "PERMANENT"}
                    onChange={(e) => handleChange("redirectType", e.target.value as "PERMANENT")}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700 block">{t("permanent")}</span>
                    <span className="text-xs text-slate-500">301 redirect</span>
                  </div>
                  {formData.redirectType === "PERMANENT" && (
                    <CheckCircle className="w-5 h-5 text-blue-500 ml-auto" />
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
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
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
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 placeholder:text-slate-400"
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
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg shadow-blue-500/25"
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
