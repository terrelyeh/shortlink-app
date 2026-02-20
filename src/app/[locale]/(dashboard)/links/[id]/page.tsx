"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { UTMBuilder } from "@/components/forms/UTMBuilder";
import { TagInput } from "@/components/tags/TagInput";
import {
  ArrowLeft,
  Link2,
  Loader2,
  Settings2,
  Target,
  AlertCircle,
  CheckCircle,
  Megaphone,
  Clock,
  Tag,
  ChevronDown,
  ChevronUp,
  Edit,
} from "lucide-react";
import Link from "next/link";

interface TagOption {
  id: string;
  name: string;
  color?: string | null;
}

interface UtmCampaignSuggestion {
  name: string;
  linkCount: number;
  clickCount: number;
  lastUsed: string;
}

interface LinkData {
  id: string;
  code: string;
  originalUrl: string;
  title: string | null;
  status: string;
  redirectType: string;
  expiresAt: string | null;
  maxClicks: number | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  createdAt: string;
  _count: { clicks: number };
  tags: { tag: TagOption }[];
}

export default function EditLinkPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("links");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const tCampaigns = useTranslations("campaigns");

  const linkId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [originalUrl, setOriginalUrl] = useState("");
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [redirectType, setRedirectType] = useState("TEMPORARY");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxClicks, setMaxClicks] = useState("");
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [utmContent, setUtmContent] = useState("");
  const [utmTerm, setUtmTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<TagOption[]>([]);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showUTM, setShowUTM] = useState(false);

  // Campaign autocomplete
  const [campaignSuggestions, setCampaignSuggestions] = useState<UtmCampaignSuggestion[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [showCampaignDropdown, setShowCampaignDropdown] = useState(false);
  const [campaignInputFocused, setCampaignInputFocused] = useState(false);
  const campaignInputRef = useRef<HTMLInputElement>(null);
  const campaignDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch link data
  useEffect(() => {
    async function fetchLink() {
      try {
        const response = await fetch(`/api/links/${linkId}`);
        if (!response.ok) throw new Error("Link not found");
        const data: LinkData = await response.json();

        // Strip UTM params from URL for editing (they are managed separately)
        let cleanUrl = data.originalUrl;
        try {
          const url = new URL(data.originalUrl);
          ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(
            (p) => url.searchParams.delete(p)
          );
          cleanUrl = url.toString();
          // Remove trailing ? if no params left
          if (cleanUrl.endsWith("?")) cleanUrl = cleanUrl.slice(0, -1);
        } catch {
          // URL parsing failed, use as-is
        }

        setOriginalUrl(cleanUrl);
        setTitle(data.title || "");
        setCode(data.code);
        setStatus(data.status);
        setRedirectType(data.redirectType);
        setUtmSource(data.utmSource || "");
        setUtmMedium(data.utmMedium || "");
        setUtmCampaign(data.utmCampaign || "");
        setUtmContent(data.utmContent || "");
        setUtmTerm(data.utmTerm || "");
        setSelectedTags(data.tags.map((t) => t.tag));

        if (data.expiresAt) {
          const d = new Date(data.expiresAt);
          setExpiresAt(d.toISOString().slice(0, 16));
        }
        if (data.maxClicks) setMaxClicks(String(data.maxClicks));

        // Auto-expand sections if they have values
        if (data.utmSource || data.utmMedium || data.utmContent || data.utmTerm) setShowUTM(true);
        if (data.expiresAt || data.maxClicks || data.redirectType === "PERMANENT") setShowAdvanced(true);
      } catch {
        setError("Failed to load link");
      } finally {
        setLoading(false);
      }
    }
    fetchLink();
  }, [linkId]);

  // Fetch campaign suggestions
  useEffect(() => {
    async function fetchCampaigns() {
      try {
        const response = await fetch("/api/utm-campaigns?limit=50");
        if (response.ok) {
          const data = await response.json();
          setCampaignSuggestions(data.campaigns || []);
        }
      } catch {
        // ignore
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

  const handleCampaignInputChange = (value: string) => {
    const normalized = value.toLowerCase().replace(/\s+/g, "_");
    setUtmCampaign(normalized);
    setShowCampaignDropdown(true);
    if (normalized && !showUTM) setShowUTM(true);
  };

  const handleCampaignSelect = (name: string) => {
    setUtmCampaign(name);
    setShowCampaignDropdown(false);
    if (!showUTM) setShowUTM(true);
  };

  const filteredSuggestions = campaignSuggestions.filter((c) =>
    c.name.toLowerCase().includes(utmCampaign.toLowerCase())
  );

  const handleUTMChange = (values: {
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
    utmContent: string;
    utmTerm: string;
  }) => {
    setUtmSource(values.utmSource);
    setUtmMedium(values.utmMedium);
    setUtmCampaign(values.utmCampaign);
    setUtmContent(values.utmContent);
    setUtmTerm(values.utmTerm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!originalUrl) {
      setError(tErrors("required"));
      return;
    }

    try {
      new URL(originalUrl);
    } catch {
      setError(tErrors("invalidUrl"));
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        originalUrl,
        title: title || null,
        status,
        redirectType,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        maxClicks: maxClicks ? parseInt(maxClicks) : null,
        utmSource: utmSource || null,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null,
        utmContent: utmContent || null,
        utmTerm: utmTerm || null,
        tags: selectedTags.map((t) => t.id),
      };

      const response = await fetch(`/api/links/${linkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update link");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update link");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const shortBaseUrl = process.env.NEXT_PUBLIC_SHORT_URL || "http://localhost:3000/s";

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Link
          href="/links"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">{t("title")}</span>
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-50 rounded-lg flex items-center justify-center">
              <Edit className="w-5 h-5 text-[#03A9F4]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                {t("editLink")}
              </h1>
              <p className="text-slate-400 text-sm font-mono">
                {shortBaseUrl}/{code}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Messages */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm">{t("updateSuccess")}</span>
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
                value={originalUrl}
                onChange={(e) => { setOriginalUrl(e.target.value); setError(null); }}
                placeholder="https://example.com/your-long-url"
                className="w-full pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] focus:bg-white transition-all placeholder:text-slate-400"
                style={{ paddingLeft: "4.5rem" }}
                required
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              {t("titleLabel")}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("titlePlaceholder")}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] focus:bg-white transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              {t("status")}
            </label>
            <div className="flex gap-2">
              {(["ACTIVE", "PAUSED", "ARCHIVED"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    status === s
                      ? s === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700 border-2 border-emerald-200"
                        : s === "PAUSED"
                          ? "bg-amber-50 text-amber-700 border-2 border-amber-200"
                          : "bg-slate-100 text-slate-700 border-2 border-slate-300"
                      : "bg-slate-50 text-slate-500 border-2 border-transparent hover:border-slate-200"
                  }`}
                >
                  {t(s === "ACTIVE" ? "active" : s === "PAUSED" ? "paused" : "archived")}
                </button>
              ))}
            </div>
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

          {/* Campaign Input */}
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

              <div className="relative">
                <input
                  ref={campaignInputRef}
                  type="text"
                  value={utmCampaign}
                  onChange={(e) => handleCampaignInputChange(e.target.value)}
                  onFocus={() => {
                    setCampaignInputFocused(true);
                    setShowCampaignDropdown(true);
                  }}
                  onBlur={() => setCampaignInputFocused(false)}
                  placeholder={tCampaigns("campaignPlaceholder")}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] bg-white text-slate-700 font-mono text-sm"
                />
                {loadingCampaigns && (
                  <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-slate-400" />
                )}

                {showCampaignDropdown && !loadingCampaigns && (campaignInputFocused || showCampaignDropdown) && (
                  <div
                    ref={campaignDropdownRef}
                    className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto"
                  >
                    {filteredSuggestions.length > 0 ? (
                      <>
                        <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-100">
                          {tCampaigns("recentCampaigns")}
                        </div>
                        {filteredSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.name}
                            type="button"
                            onClick={() => handleCampaignSelect(suggestion.name)}
                            className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center justify-between group"
                          >
                            <div>
                              <span className="font-mono text-sm text-slate-700">{suggestion.name}</span>
                              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                <span>{suggestion.linkCount} {tCampaigns("linksCount")}</span>
                                <span>{suggestion.clickCount} {tCampaigns("clicksCount")}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Clock className="w-3 h-3" />
                              <span>{new Date(suggestion.lastUsed).toLocaleDateString()}</span>
                            </div>
                          </button>
                        ))}
                      </>
                    ) : utmCampaign ? (
                      <div className="px-4 py-3 text-sm text-slate-600">
                        <span className="text-slate-400">{tCampaigns("newCampaign")}</span>{" "}
                        <span className="font-mono font-medium text-[#03A9F4]">{utmCampaign}</span>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {utmCampaign && (
                <p className="mt-2 text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
                  utm_campaign={" "}
                  <span className="font-mono font-medium">{utmCampaign}</span>
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
                  <span className="font-semibold text-slate-700 block">UTM Parameters</span>
                  <span className="text-xs text-slate-500">Add tracking parameters to your link</span>
                </div>
              </div>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${showUTM ? "bg-sky-100" : "bg-slate-100"}`}>
                {showUTM ? <ChevronUp className="w-5 h-5 text-[#03A9F4]" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
              </div>
            </button>
            {showUTM && (
              <div className="p-5 border-t border-slate-200 bg-slate-50/50">
                <UTMBuilder
                  values={{ utmSource, utmMedium, utmCampaign, utmContent, utmTerm }}
                  onChange={handleUTMChange}
                  originalUrl={originalUrl}
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
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Settings2 className="w-5 h-5 text-slate-500" />
                </div>
                <div className="text-left">
                  <span className="font-semibold text-slate-700 block">Advanced Options</span>
                  <span className="text-xs text-slate-500">Redirect type, expiration, click limits</span>
                </div>
              </div>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${showAdvanced ? "bg-slate-200" : "bg-slate-100"}`}>
                {showAdvanced ? <ChevronUp className="w-5 h-5 text-slate-600" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
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
                    <label className={`flex-1 flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all border-2 ${
                      redirectType === "TEMPORARY"
                        ? "border-[#03A9F4] bg-sky-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}>
                      <input
                        type="radio"
                        name="redirectType"
                        value="TEMPORARY"
                        checked={redirectType === "TEMPORARY"}
                        onChange={() => setRedirectType("TEMPORARY")}
                        className="w-4 h-4 text-[#03A9F4]"
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-700 block">{t("temporary")}</span>
                        <span className="text-xs text-slate-500">302 redirect</span>
                      </div>
                      {redirectType === "TEMPORARY" && <CheckCircle className="w-5 h-5 text-[#03A9F4] ml-auto" />}
                    </label>
                    <label className={`flex-1 flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all border-2 ${
                      redirectType === "PERMANENT"
                        ? "border-[#03A9F4] bg-sky-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}>
                      <input
                        type="radio"
                        name="redirectType"
                        value="PERMANENT"
                        checked={redirectType === "PERMANENT"}
                        onChange={() => setRedirectType("PERMANENT")}
                        className="w-4 h-4 text-[#03A9F4]"
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-700 block">{t("permanent")}</span>
                        <span className="text-xs text-slate-500">301 redirect</span>
                      </div>
                      {redirectType === "PERMANENT" && <CheckCircle className="w-5 h-5 text-[#03A9F4] ml-auto" />}
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
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] transition-all"
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
                    value={maxClicks}
                    onChange={(e) => setMaxClicks(e.target.value)}
                    placeholder={t("noLimit")}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all font-medium"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#03A9F4] text-white rounded-xl hover:bg-[#0288D1] transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {tCommon("saving")}
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  {tCommon("save")}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
