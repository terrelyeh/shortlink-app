"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { UTMBuilder } from "./UTMBuilder";
import { Link2, ChevronDown, ChevronUp, Loader2, Settings2, Target, AlertCircle, CheckCircle, Megaphone, Clock, Tag, Check, X as XIcon } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { TagInput } from "@/components/tags/TagInput";

interface TagOption {
  id: string;
  name: string;
  color?: string | null;
}

interface CampaignEntity {
  id: string;
  name: string;
  displayName: string | null;
  status: string;
  defaultSource: string | null;
  defaultMedium: string | null;
  linkCount: number;
}

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
  const tCampaigns = useTranslations("campaigns");
  const tUtm = useTranslations("utm");

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showUTM, setShowUTM] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<TagOption[]>([]);

  // Slug availability checker
  const debouncedCode = useDebounce(formData.customCode, 500);
  const [codeStatus, setCodeStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");

  useEffect(() => {
    if (!debouncedCode || debouncedCode.length < 3) {
      setCodeStatus("idle");
      return;
    }
    setCodeStatus("checking");
    fetch(`/api/links/check-code?code=${encodeURIComponent(debouncedCode)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.available === true) setCodeStatus("available");
        else if (data.reason === "invalid_format") setCodeStatus("invalid");
        else setCodeStatus("taken");
      })
      .catch(() => setCodeStatus("idle"));
  }, [debouncedCode]);

  // UTM governance — approved sources/mediums for the current workspace
  const [approvedSources, setApprovedSources] = useState<string[]>([]);
  const [approvedMediums, setApprovedMediums] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/workspace/utm-settings")
      .then((r) => r.json())
      .then((data) => {
        setApprovedSources(data.approvedSources || []);
        setApprovedMediums(data.approvedMediums || []);
      })
      .catch(() => {}); // silently ignore — no workspace = no governance
  }, []);

  const sourceWarning =
    approvedSources.length > 0 &&
    formData.utmSource &&
    !approvedSources.includes(formData.utmSource.toLowerCase());

  const mediumWarning =
    approvedMediums.length > 0 &&
    formData.utmMedium &&
    !approvedMediums.includes(formData.utmMedium.toLowerCase());

  // Campaign entity state
  const [campaigns, setCampaigns] = useState<CampaignEntity[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignEntity | null>(null);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [showCampaignDropdown, setShowCampaignDropdown] = useState(false);
  const [campaignSearch, setCampaignSearch] = useState("");
  const campaignInputRef = useRef<HTMLInputElement>(null);
  const campaignDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch campaign entities on mount
  useEffect(() => {
    async function fetchCampaigns() {
      try {
        const response = await fetch("/api/campaigns");
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

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        campaignDropdownRef.current &&
        !campaignDropdownRef.current.contains(event.target as Node) &&
        campaignInputRef.current &&
        !campaignInputRef.current.contains(event.target as Node)
      ) {
        setShowCampaignDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleCampaignSelect = (campaign: CampaignEntity) => {
    setSelectedCampaign(campaign);
    setCampaignSearch("");
    setShowCampaignDropdown(false);
    // Auto-fill UTM values from Campaign entity
    setFormData((prev) => ({
      ...prev,
      utmCampaign: campaign.name,
      utmSource: campaign.defaultSource || prev.utmSource,
      utmMedium: campaign.defaultMedium || prev.utmMedium,
    }));
    // Auto-expand UTM section
    if (!showUTM) setShowUTM(true);
  };

  const handleCampaignClear = () => {
    setSelectedCampaign(null);
    setFormData((prev) => ({ ...prev, utmCampaign: "" }));
  };

  // Filter campaigns based on search input
  const filteredCampaigns = campaigns.filter((c) =>
    c.name.toLowerCase().includes(campaignSearch.toLowerCase()) ||
    (c.displayName && c.displayName.toLowerCase().includes(campaignSearch.toLowerCase()))
  );

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
      // Convert datetime-local format to ISO 8601 format for API validation
      const expiresAtISO = formData.expiresAt
        ? new Date(formData.expiresAt).toISOString()
        : undefined;

      const payload = {
        originalUrl: formData.originalUrl,
        customCode: formData.customCode || undefined,
        title: formData.title || undefined,
        redirectType: formData.redirectType,
        expiresAt: expiresAtISO,
        maxClicks: formData.maxClicks ? parseInt(formData.maxClicks) : undefined,
        campaignId: selectedCampaign?.id || undefined,
        utmSource: formData.utmSource || undefined,
        utmMedium: formData.utmMedium || undefined,
        utmCampaign: formData.utmCampaign || undefined,
        utmContent: formData.utmContent || undefined,
        utmTerm: formData.utmTerm || undefined,
        tags: selectedTags.length > 0 ? selectedTags.map((t) => t.id) : undefined,
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

      // Use replace to prevent the form page from being in browser history
      // This ensures clean navigation back to links list
      router.replace("/links");
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
          <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
            <Link2 className="w-5 h-5 text-slate-500" />
          </div>
          <input
            type="url"
            value={formData.originalUrl}
            onChange={(e) => handleChange("originalUrl", e.target.value)}
            placeholder="https://example.com/your-long-url"
            className="w-full pl-18 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] focus:bg-white transition-all duration-200 placeholder:text-slate-400"
            style={{ paddingLeft: "4.5rem" }}
            required
          />
        </div>
      </div>

      {/* Custom Code with availability checker */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          {t("customCode")}
        </label>
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-sm bg-slate-100 px-3 py-2 rounded-lg whitespace-nowrap">
            {process.env.NEXT_PUBLIC_SHORT_URL || "domain.com"}/s/
          </span>
          <div className="flex-1 relative">
            <input
              type="text"
              value={formData.customCode}
              onChange={(e) => { handleChange("customCode", e.target.value); setCodeStatus("idle"); }}
              placeholder={t("customCodePlaceholder")}
              className={`w-full px-4 py-3 pr-10 bg-slate-50 border rounded-xl focus:ring-2 focus:bg-white transition-all duration-200 placeholder:text-slate-400 ${
                codeStatus === "available"
                  ? "border-emerald-400 focus:ring-emerald-200 focus:border-emerald-400"
                  : codeStatus === "taken" || codeStatus === "invalid"
                  ? "border-red-400 focus:ring-red-200 focus:border-red-400"
                  : "border-slate-200 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
              }`}
              pattern="^[a-zA-Z0-9_-]{3,50}$"
            />
            {/* Availability indicator */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {codeStatus === "checking" && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
              {codeStatus === "available" && <Check className="w-4 h-4 text-emerald-500" />}
              {(codeStatus === "taken" || codeStatus === "invalid") && <XIcon className="w-4 h-4 text-red-500" />}
            </div>
          </div>
        </div>
        <p className={`mt-2 text-xs ${
          codeStatus === "available" ? "text-emerald-600" :
          codeStatus === "taken" ? "text-red-600" :
          codeStatus === "invalid" ? "text-red-600" :
          "text-slate-500"
        }`}>
          {codeStatus === "available" && "✓ This slug is available"}
          {codeStatus === "taken" && "✗ This slug is already taken"}
          {codeStatus === "invalid" && "✗ 3–50 alphanumeric characters, hyphens, or underscores only"}
          {(codeStatus === "idle" || codeStatus === "checking") && t("autoGeneratedCode")}
        </p>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          {t("titleLabel")}
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => handleChange("title", e.target.value)}
          placeholder={t("titlePlaceholder")}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] focus:bg-white transition-all duration-200 placeholder:text-slate-400"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
          <Tag className="w-4 h-4" />
          {t("tags")}
        </label>
        <TagInput
          selectedTags={selectedTags}
          onChange={setSelectedTags}
          placeholder={t("addTag")}
        />
      </div>

      {/* Campaign Entity Selector */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-slate-500" />
            </div>
            <div className="text-left">
              <span className="font-semibold text-slate-700 block">{tCampaigns("title")}</span>
              <span className="text-xs text-slate-500">{tCampaigns("campaignDescription")}</span>
            </div>
          </div>

          {selectedCampaign ? (
            // Selected campaign display
            <div className="flex items-center justify-between p-3 bg-violet-50 border border-violet-100 rounded-xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium text-violet-700">{selectedCampaign.name}</span>
                  {selectedCampaign.displayName && (
                    <span className="text-xs text-slate-500">({selectedCampaign.displayName})</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                  <span>{selectedCampaign.linkCount} {tCampaigns("linksCount")}</span>
                  {selectedCampaign.defaultSource && (
                    <span className="px-1.5 py-0.5 bg-cyan-50 text-cyan-700 rounded border border-cyan-100 text-[10px]">
                      {selectedCampaign.defaultSource}
                    </span>
                  )}
                  {selectedCampaign.defaultMedium && (
                    <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-100 text-[10px]">
                      {selectedCampaign.defaultMedium}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCampaignClear}
                className="p-1.5 hover:bg-violet-100 rounded-lg transition-colors text-violet-400 hover:text-violet-600"
              >
                <AlertCircle className="w-4 h-4" />
              </button>
            </div>
          ) : (
            // Campaign search/select
            <div className="relative">
              <input
                ref={campaignInputRef}
                type="text"
                value={campaignSearch}
                onChange={(e) => {
                  setCampaignSearch(e.target.value);
                  setShowCampaignDropdown(true);
                }}
                onFocus={() => setShowCampaignDropdown(true)}
                placeholder={tCampaigns("campaignPlaceholder")}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] bg-white text-slate-700 text-sm"
              />
              {loadingCampaigns && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-slate-400" />
              )}

              {showCampaignDropdown && !loadingCampaigns && (
                <div
                  ref={campaignDropdownRef}
                  className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto"
                >
                  {filteredCampaigns.length > 0 ? (
                    <>
                      <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-100">
                        {tCampaigns("recentCampaigns")}
                      </div>
                      {filteredCampaigns.map((campaign) => (
                        <button
                          key={campaign.id}
                          type="button"
                          onClick={() => handleCampaignSelect(campaign)}
                          className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center justify-between group"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-slate-700">{campaign.name}</span>
                              <span className={`w-1.5 h-1.5 rounded-full ${campaign.status === "ACTIVE" ? "bg-emerald-400" : campaign.status === "DRAFT" ? "bg-slate-300" : "bg-amber-400"}`} />
                            </div>
                            {campaign.displayName && (
                              <p className="text-xs text-slate-400 mt-0.5">{campaign.displayName}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                              <span>{campaign.linkCount} {tCampaigns("linksCount")}</span>
                              {campaign.defaultSource && (
                                <span className="px-1 py-0.5 bg-cyan-50 text-cyan-600 rounded text-[10px]">{campaign.defaultSource}</span>
                              )}
                              {campaign.defaultMedium && (
                                <span className="px-1 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px]">{campaign.defaultMedium}</span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </>
                  ) : campaignSearch ? (
                    <div className="px-4 py-3 text-sm text-slate-500">
                      {tCampaigns("noPreviousCampaigns")}
                    </div>
                  ) : campaigns.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-500">
                      {tCampaigns("noPreviousCampaigns")}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {selectedCampaign && (
            <p className="mt-2 text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
              utm_campaign={" "}
              <span className="font-mono font-medium">{selectedCampaign.name}</span>
              {selectedCampaign.defaultSource && (
                <span className="ml-2">· utm_source=<span className="font-mono font-medium">{selectedCampaign.defaultSource}</span></span>
              )}
              {selectedCampaign.defaultMedium && (
                <span className="ml-2">· utm_medium=<span className="font-mono font-medium">{selectedCampaign.defaultMedium}</span></span>
              )}
            </p>
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
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-slate-500" />
            </div>
            <div className="text-left">
              <span className="font-semibold text-slate-700 block">{tUtm("title")}</span>
              <span className="text-xs text-slate-500">{t("utmDescription")}</span>
            </div>
          </div>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${showUTM ? "bg-sky-100" : "bg-slate-100"}`}>
            {showUTM ? (
              <ChevronUp className="w-5 h-5 text-[#03A9F4]" />
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
              campaignLocked={!!selectedCampaign}
            />

            {/* UTM Governance Warnings */}
            {(sourceWarning || mediumWarning) && (
              <div className="mt-3 flex flex-col gap-1.5">
                {sourceWarning && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      <span className="font-medium">{formData.utmSource}</span> is not in the approved sources list.
                      {approvedSources.length > 0 && (
                        <> Approved: {approvedSources.slice(0, 5).join(", ")}{approvedSources.length > 5 ? "…" : ""}</>
                      )}
                    </span>
                  </div>
                )}
                {mediumWarning && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      <span className="font-medium">{formData.utmMedium}</span> is not in the approved mediums list.
                      {approvedMediums.length > 0 && (
                        <> Approved: {approvedMediums.slice(0, 5).join(", ")}{approvedMediums.length > 5 ? "…" : ""}</>
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}
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
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <Settings2 className="w-5 h-5 text-slate-500" />
            </div>
            <div className="text-left">
              <span className="font-semibold text-slate-700 block">{t("advancedOptions")}</span>
              <span className="text-xs text-slate-500">{t("advancedOptionsDesc")}</span>
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
                    ? "border-[#03A9F4] bg-sky-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}>
                  <input
                    type="radio"
                    name="redirectType"
                    value="TEMPORARY"
                    checked={formData.redirectType === "TEMPORARY"}
                    onChange={(e) => handleChange("redirectType", e.target.value as "TEMPORARY")}
                    className="w-4 h-4 text-[#03A9F4]"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700 block">{t("temporary")}</span>
                    <span className="text-xs text-slate-500">{t("redirect302")}</span>
                  </div>
                  {formData.redirectType === "TEMPORARY" && (
                    <CheckCircle className="w-5 h-5 text-[#03A9F4] ml-auto" />
                  )}
                </label>
                <label className={`flex-1 flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 ${
                  formData.redirectType === "PERMANENT"
                    ? "border-[#03A9F4] bg-sky-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}>
                  <input
                    type="radio"
                    name="redirectType"
                    value="PERMANENT"
                    checked={formData.redirectType === "PERMANENT"}
                    onChange={(e) => handleChange("redirectType", e.target.value as "PERMANENT")}
                    className="w-4 h-4 text-[#03A9F4]"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700 block">{t("permanent")}</span>
                    <span className="text-xs text-slate-500">{t("redirect301")}</span>
                  </div>
                  {formData.redirectType === "PERMANENT" && (
                    <CheckCircle className="w-5 h-5 text-[#03A9F4] ml-auto" />
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
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] transition-all duration-200"
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
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] transition-all duration-200 placeholder:text-slate-400"
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
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#03A9F4] text-white rounded-xl hover:bg-[#0288D1] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t("creating")}
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
