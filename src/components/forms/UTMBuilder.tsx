"use client";

import { useEffect, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  UTM_MEDIUMS,
  getSourcesForMedium,
  isCustomSourceAllowed,
  normalizeSource,
} from "@/lib/utils/utm";
import { ChevronDown, FileText, Loader2, AlertCircle } from "lucide-react";

interface UTMParams {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
}

interface UTMTemplate {
  id: string;
  name: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
}

interface UTMBuilderProps {
  values: UTMParams;
  onChange: (values: UTMParams) => void;
  originalUrl: string;
}

export function UTMBuilder({ values, onChange, originalUrl }: UTMBuilderProps) {
  const t = useTranslations("utm");
  const [templates, setTemplates] = useState<UTMTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  // Fetch templates on mount
  useEffect(() => {
    const fetchTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const response = await fetch("/api/templates");
        if (response.ok) {
          const data = await response.json();
          setTemplates(data);
        }
      } catch (error) {
        console.error("Failed to fetch templates:", error);
      } finally {
        setLoadingTemplates(false);
      }
    };
    fetchTemplates();
  }, []);

  // Get available sources based on selected medium
  const availableSources = useMemo(() => {
    if (!values.utmMedium) return [];
    return getSourcesForMedium(values.utmMedium);
  }, [values.utmMedium]);

  // Check if current source is valid for selected medium
  const sourceWarning = useMemo(() => {
    if (!values.utmMedium || !values.utmSource) return null;
    const normalizedSource = normalizeSource(values.utmSource);
    const sources = getSourcesForMedium(values.utmMedium);
    if (sources.length > 0 && !sources.includes(normalizedSource)) {
      // Check if custom source is allowed
      if (isCustomSourceAllowed(values.utmMedium)) {
        return null; // Custom sources allowed, no warning
      }
      return t("sourceNotRecommended");
    }
    return null;
  }, [values.utmMedium, values.utmSource, t]);

  const handleChange = (field: keyof UTMParams, value: string) => {
    const newValues = { ...values, [field]: value };

    // When medium changes, check if current source is still valid
    if (field === "utmMedium" && values.utmSource) {
      const newSources = getSourcesForMedium(value);
      const normalizedSource = normalizeSource(values.utmSource);
      // Clear source if it's not in the new medium's sources and custom source not allowed
      if (
        newSources.length > 0 &&
        !newSources.includes(normalizedSource) &&
        !isCustomSourceAllowed(value)
      ) {
        newValues.utmSource = "";
      }
    }

    onChange(newValues);
    setSelectedTemplate(""); // Clear template selection when manually editing
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    if (!templateId) return;

    const template = templates.find((t) => t.id === templateId);
    if (template) {
      onChange({
        utmSource: template.source || "",
        utmMedium: template.medium || "",
        utmCampaign: template.campaign || "",
        utmContent: template.content || "",
        utmTerm: template.term || "",
      });
    }
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
      {/* Template Selector */}
      {templates.length > 0 && (
        <div className="p-4 bg-sky-50 border border-sky-100 rounded-xl">
          <label className="block text-sm font-semibold text-sky-700 mb-2">
            <FileText className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
            {t("applyTemplate")}
          </label>
          <div className="relative">
            <select
              value={selectedTemplate}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="w-full px-4 py-2.5 border border-sky-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] appearance-none bg-white text-slate-700"
              disabled={loadingTemplates}
            >
              <option value="">
                {loadingTemplates ? "Loading templates..." : "Select a template..."}
              </option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                  {template.source && ` (${template.source})`}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              {loadingTemplates ? (
                <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Select a saved template to auto-fill UTM parameters
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* UTM Medium - Select First */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t("medium")}
            <span className="ml-1 text-xs text-slate-400 font-normal">
              ({t("selectFirst")})
            </span>
          </label>
          <div className="relative">
            <select
              value={values.utmMedium}
              onChange={(e) => handleChange("utmMedium", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] appearance-none bg-white"
            >
              <option value="">{t("mediumPlaceholder")}</option>
              {UTM_MEDIUMS.map((medium) => (
                <option key={medium} value={medium}>
                  {medium}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          <input
            type="text"
            value={values.utmMedium}
            onChange={(e) => handleChange("utmMedium", e.target.value)}
            placeholder={t("mediumPlaceholder")}
            className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] text-sm"
          />
        </div>

        {/* UTM Source - Based on Medium */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t("source")}
          </label>
          <div className="relative">
            <select
              value={values.utmSource}
              onChange={(e) => handleChange("utmSource", e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] appearance-none bg-white ${
                !values.utmMedium
                  ? "border-slate-100 bg-slate-50 text-slate-400"
                  : "border-slate-200"
              }`}
              disabled={!values.utmMedium}
            >
              <option value="">
                {!values.utmMedium
                  ? t("selectMediumFirst")
                  : t("sourcePlaceholder")}
              </option>
              {availableSources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          <input
            type="text"
            value={values.utmSource}
            onChange={(e) => handleChange("utmSource", e.target.value)}
            placeholder={
              isCustomSourceAllowed(values.utmMedium)
                ? t("sourceCustomPlaceholder")
                : t("sourcePlaceholder")
            }
            className={`mt-2 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] text-sm ${
              sourceWarning
                ? "border-amber-300 bg-amber-50"
                : "border-slate-200"
            }`}
            disabled={!values.utmMedium}
          />
          {sourceWarning && (
            <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {sourceWarning}
            </p>
          )}
          {isCustomSourceAllowed(values.utmMedium) && (
            <p className="mt-1 text-xs text-slate-500">
              {t("customSourceAllowed")}
            </p>
          )}
        </div>

        {/* UTM Campaign */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t("campaign")}
          </label>
          <input
            type="text"
            value={values.utmCampaign}
            onChange={(e) => handleChange("utmCampaign", e.target.value)}
            placeholder={t("campaignPlaceholder")}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
          />
        </div>

        {/* UTM Content */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t("content")}
          </label>
          <input
            type="text"
            value={values.utmContent}
            onChange={(e) => handleChange("utmContent", e.target.value)}
            placeholder={t("contentPlaceholder")}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
          />
        </div>

        {/* UTM Term */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t("term")}
          </label>
          <input
            type="text"
            value={values.utmTerm}
            onChange={(e) => handleChange("utmTerm", e.target.value)}
            placeholder={t("termPlaceholder")}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
          />
        </div>
      </div>

      {/* URL Preview */}
      {hasUtmParams && originalUrl && (
        <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            {t("preview")}
          </label>
          <p className="text-sm text-slate-600 break-all font-mono bg-white p-3 rounded border border-slate-100">
            {previewUrl}
          </p>
        </div>
      )}
    </div>
  );
}
