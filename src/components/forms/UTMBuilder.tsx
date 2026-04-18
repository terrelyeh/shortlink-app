"use client";

import { useEffect, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  UTM_MEDIUMS,
  UTM_MEDIUM_LABELS,
  getSourcesForMedium,
  getSourceOptionsForMedium,
  getMediumContext,
  isCustomSourceAllowed,
  normalizeSource,
  type UTMMedium,
} from "@/lib/utils/utm";
import { ChevronDown, FileText, Loader2, AlertCircle, Info, X } from "lucide-react";

/** Hover tooltip with an info icon — explains the field's purpose inline. */
function FieldHint({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center ml-1.5 align-middle">
      <Info
        className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 cursor-help transition-colors"
        aria-hidden="true"
      />
      <span className="sr-only">{text}</span>
      <span
        role="tooltip"
        className="pointer-events-none invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute left-0 top-full mt-1.5 z-30 w-64 px-3 py-2 text-xs font-normal leading-relaxed text-slate-100 bg-slate-800 rounded-lg shadow-lg transition-opacity"
      >
        {text}
      </span>
    </span>
  );
}

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
  campaignLocked?: boolean; // When a Campaign entity is selected, lock the campaign field
}

export function UTMBuilder({ values, onChange, originalUrl, campaignLocked }: UTMBuilderProps) {
  const t = useTranslations("utm");
  const [templates, setTemplates] = useState<UTMTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  // Workspace-level UTM governance (whitelist). Empty arrays = no restriction.
  const [approvedSources, setApprovedSources] = useState<string[]>([]);
  const [approvedMediums, setApprovedMediums] = useState<string[]>([]);

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

  // Fetch workspace UTM governance rules once on mount. If the workspace
  // hasn't configured them (or user isn't in a workspace), both arrays stay
  // empty and no warnings show.
  useEffect(() => {
    fetch("/api/workspace/utm-settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setApprovedSources(data.approvedSources || []);
        setApprovedMediums(data.approvedMediums || []);
      })
      .catch(() => {
        /* silent — governance is optional */
      });
  }, []);

  const sourceGovernanceWarning = useMemo(() => {
    if (approvedSources.length === 0 || !values.utmSource) return null;
    const s = values.utmSource.trim().toLowerCase();
    if (!approvedSources.includes(s)) {
      return `"${values.utmSource}" 不在這個 workspace 的核准清單（${approvedSources.join(", ")}）— 儲存時會被擋下。`;
    }
    return null;
  }, [approvedSources, values.utmSource]);

  const mediumGovernanceWarning = useMemo(() => {
    if (approvedMediums.length === 0 || !values.utmMedium) return null;
    const m = values.utmMedium.trim().toLowerCase();
    if (!approvedMediums.includes(m)) {
      return `"${values.utmMedium}" 不在這個 workspace 的核准清單（${approvedMediums.join(", ")}）— 儲存時會被擋下。`;
    }
    return null;
  }, [approvedMediums, values.utmMedium]);

  // Get available sources (with labels) based on selected medium
  const availableSourceOptions = useMemo(() => {
    if (!values.utmMedium) return [];
    return getSourceOptionsForMedium(values.utmMedium);
  }, [values.utmMedium]);

  const mediumContext = useMemo(
    () => (values.utmMedium ? getMediumContext(values.utmMedium) : null),
    [values.utmMedium],
  );

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
        {/* UTM Medium — combobox via datalist (pick from list or type custom) */}
        <div>
          <label className="flex items-center text-sm font-medium text-slate-700 mb-1">
            {t("medium")}
            <span className="ml-1 text-xs text-slate-400 font-normal">
              ({t("selectFirst")})
            </span>
            <FieldHint text={t("mediumTip")} />
          </label>
          <div className="relative">
            <input
              type="text"
              list="utm-medium-options"
              value={values.utmMedium}
              onChange={(e) => handleChange("utmMedium", e.target.value)}
              placeholder={t("mediumPlaceholder")}
              className="w-full px-3 py-2 pr-9 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] bg-white"
              autoComplete="off"
            />
            {values.utmMedium ? (
              <button
                type="button"
                onClick={() => handleChange("utmMedium", "")}
                aria-label="Clear medium"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            )}
            <datalist id="utm-medium-options">
              {/* When workspace governance is set, surface approved mediums
                  first — they're the ones that will actually save. Anything
                  not on the list will trip the warning below. */}
              {approvedMediums.length > 0
                ? approvedMediums.map((m) => (
                    <option
                      key={m}
                      value={m}
                      label={UTM_MEDIUM_LABELS[m as UTMMedium] ?? m}
                    >
                      {UTM_MEDIUM_LABELS[m as UTMMedium] ?? m}
                    </option>
                  ))
                : UTM_MEDIUMS.map((medium) => (
                    <option
                      key={medium}
                      value={medium}
                      label={UTM_MEDIUM_LABELS[medium]}
                    >
                      {UTM_MEDIUM_LABELS[medium]}
                    </option>
                  ))}
            </datalist>
          </div>
          {mediumGovernanceWarning && (
            <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {mediumGovernanceWarning}
            </p>
          )}
        </div>

        {/* UTM Source — combobox via datalist (filtered by medium) */}
        <div>
          <label className="flex items-center text-sm font-medium text-slate-700 mb-1">
            {t("source")}
            <FieldHint text={t("sourceTip")} />
          </label>
          <div className="relative">
            <input
              type="text"
              list="utm-source-options"
              value={values.utmSource}
              onChange={(e) => handleChange("utmSource", e.target.value)}
              placeholder={
                !values.utmMedium
                  ? t("selectMediumFirst")
                  : isCustomSourceAllowed(values.utmMedium)
                    ? t("sourceCustomPlaceholder")
                    : t("sourcePlaceholder")
              }
              disabled={!values.utmMedium}
              autoComplete="off"
              className={`w-full px-3 py-2 pr-9 border rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] ${
                !values.utmMedium
                  ? "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed"
                  : sourceWarning
                    ? "border-amber-300 bg-amber-50"
                    : "border-slate-200 bg-white"
              }`}
            />
            {values.utmSource && values.utmMedium ? (
              <button
                type="button"
                onClick={() => handleChange("utmSource", "")}
                aria-label="Clear source"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            )}
            <datalist id="utm-source-options">
              {/* Approved workspace sources take priority when governance is
                  enabled. Fall back to medium-specific options otherwise. */}
              {approvedSources.length > 0
                ? approvedSources.map((s) => (
                    <option key={s} value={s} label={s}>
                      {s}
                    </option>
                  ))
                : availableSourceOptions.map((opt) => (
                    // Both `label` and inner text — maximises cross-browser support.
                    // Chrome/Safari render the label; Firefox falls back to inner text.
                    <option key={opt.value} value={opt.value} label={opt.label}>
                      {opt.label}
                    </option>
                  ))}
            </datalist>
          </div>
          {sourceGovernanceWarning ? (
            <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {sourceGovernanceWarning}
            </p>
          ) : sourceWarning ? (
            <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {sourceWarning}
            </p>
          ) : null}
          {isCustomSourceAllowed(values.utmMedium) && (
            <p className="mt-1 text-xs text-slate-500">
              {t("customSourceAllowed")}
            </p>
          )}
        </div>

        {/* Medium context hint — orients the user on what to pick for source */}
        {mediumContext && (
          <div className="md:col-span-2 -mt-1 flex gap-2 p-3 bg-sky-50/60 border border-sky-100 rounded-lg">
            <Info className="w-4 h-4 text-sky-500 mt-0.5 shrink-0" />
            <div className="space-y-0.5 text-xs">
              <p className="font-medium text-sky-900">{mediumContext.title}</p>
              <p className="text-sky-700/80 leading-relaxed">
                {mediumContext.tip}
              </p>
            </div>
          </div>
        )}

        {/* UTM Campaign */}
        <div>
          <label className="flex items-center text-sm font-medium text-slate-700 mb-1">
            {t("campaign")}
            {campaignLocked && (
              <span className="ml-1.5 text-[10px] text-violet-500 font-normal bg-violet-50 px-1.5 py-0.5 rounded">
                from Campaign
              </span>
            )}
            <FieldHint text={t("campaignTip")} />
          </label>
          <input
            type="text"
            value={values.utmCampaign}
            onChange={(e) => handleChange("utmCampaign", e.target.value)}
            placeholder={t("campaignPlaceholder")}
            readOnly={campaignLocked}
            className={`w-full px-3 py-2 border rounded-lg ${
              campaignLocked
                ? "border-violet-200 bg-violet-50/50 text-violet-700 cursor-not-allowed"
                : "border-slate-200 focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
            }`}
          />
        </div>

        {/* UTM Content */}
        <div>
          <label className="flex items-center text-sm font-medium text-slate-700 mb-1">
            {t("content")}
            <FieldHint text={t("contentTip")} />
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
          <label className="flex items-center text-sm font-medium text-slate-700 mb-1">
            {t("term")}
            <FieldHint text={t("termTip")} />
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
