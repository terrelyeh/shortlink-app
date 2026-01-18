"use client";

import { useTranslations } from "next-intl";
import { UTM_SOURCES, UTM_MEDIUMS } from "@/lib/utils/utm";
import { ChevronDown } from "lucide-react";

interface UTMParams {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
}

interface UTMBuilderProps {
  values: UTMParams;
  onChange: (values: UTMParams) => void;
  originalUrl: string;
}

export function UTMBuilder({ values, onChange, originalUrl }: UTMBuilderProps) {
  const t = useTranslations("utm");

  const handleChange = (field: keyof UTMParams, value: string) => {
    onChange({ ...values, [field]: value });
  };

  // Generate preview URL
  const getPreviewUrl = () => {
    if (!originalUrl) return "";
    try {
      const url = new URL(originalUrl);
      if (values.utmSource) url.searchParams.set("utm_source", values.utmSource);
      if (values.utmMedium) url.searchParams.set("utm_medium", values.utmMedium);
      if (values.utmCampaign) url.searchParams.set("utm_campaign", values.utmCampaign);
      if (values.utmContent) url.searchParams.set("utm_content", values.utmContent);
      if (values.utmTerm) url.searchParams.set("utm_term", values.utmTerm);
      return url.toString();
    } catch {
      return originalUrl;
    }
  };

  const previewUrl = getPreviewUrl();
  const hasUtmParams = values.utmSource || values.utmMedium || values.utmCampaign;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">{t("title")}</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* UTM Source */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("source")}
          </label>
          <div className="relative">
            <select
              value={values.utmSource}
              onChange={(e) => handleChange("utmSource", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="">{t("sourcePlaceholder")}</option>
              {UTM_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <input
            type="text"
            value={values.utmSource}
            onChange={(e) => handleChange("utmSource", e.target.value)}
            placeholder={t("sourcePlaceholder")}
            className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>

        {/* UTM Medium */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("medium")}
          </label>
          <div className="relative">
            <select
              value={values.utmMedium}
              onChange={(e) => handleChange("utmMedium", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="">{t("mediumPlaceholder")}</option>
              {UTM_MEDIUMS.map((medium) => (
                <option key={medium} value={medium}>
                  {medium}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <input
            type="text"
            value={values.utmMedium}
            onChange={(e) => handleChange("utmMedium", e.target.value)}
            placeholder={t("mediumPlaceholder")}
            className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>

        {/* UTM Campaign */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("campaign")}
          </label>
          <input
            type="text"
            value={values.utmCampaign}
            onChange={(e) => handleChange("utmCampaign", e.target.value)}
            placeholder={t("campaignPlaceholder")}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* UTM Content */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("content")}
          </label>
          <input
            type="text"
            value={values.utmContent}
            onChange={(e) => handleChange("utmContent", e.target.value)}
            placeholder={t("contentPlaceholder")}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* UTM Term */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("term")}
          </label>
          <input
            type="text"
            value={values.utmTerm}
            onChange={(e) => handleChange("utmTerm", e.target.value)}
            placeholder={t("termPlaceholder")}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* URL Preview */}
      {hasUtmParams && originalUrl && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("preview")}
          </label>
          <p className="text-sm text-gray-600 break-all font-mono">{previewUrl}</p>
        </div>
      )}
    </div>
  );
}
