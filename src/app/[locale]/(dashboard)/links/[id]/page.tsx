"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { UTMBuilder } from "@/components/forms/UTMBuilder";
import { TagInput } from "@/components/tags/TagInput";
import { useToast } from "@/components/ui/Toast";
import {
  ArrowLeft,
  Link2,
  Loader2,
  Settings2,
  Target,
  AlertCircle,
  CheckCircle,
  Tag,
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
} from "lucide-react";
import Link from "next/link";

interface TagOption {
  id: string;
  name: string;
  color?: string | null;
}

interface LinkVariantUI {
  id: string;
  url: string;
  weight: number;
  label?: string;
}

interface LinkData {
  id: string;
  code: string;
  originalUrl: string;
  title: string | null;
  status: string;
  redirectType: string;
  startsAt: string | null;
  expiresAt: string | null;
  maxClicks: number | null;
  allowedCountries: string[];
  variants: LinkVariantUI[] | null;
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
  const tUtm = useTranslations("utm");
  const toast = useToast();

  const linkId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [originalUrl, setOriginalUrl] = useState("");
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [redirectType, setRedirectType] = useState("TEMPORARY");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxClicks, setMaxClicks] = useState("");
  const [allowedCountries, setAllowedCountries] = useState<string[]>([]);
  const [newCountry, setNewCountry] = useState("");
  const [variants, setVariants] = useState<LinkVariantUI[]>([]);
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [utmContent, setUtmContent] = useState("");
  const [utmTerm, setUtmTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<TagOption[]>([]);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showUTM, setShowUTM] = useState(false);

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

        if (data.startsAt) {
          setStartsAt(new Date(data.startsAt).toISOString().slice(0, 16));
        }
        if (data.expiresAt) {
          const d = new Date(data.expiresAt);
          setExpiresAt(d.toISOString().slice(0, 16));
        }
        if (data.maxClicks) setMaxClicks(String(data.maxClicks));
        if (data.allowedCountries?.length) setAllowedCountries(data.allowedCountries);
        if (Array.isArray(data.variants) && data.variants.length > 0) {
          setVariants(data.variants);
        }

        // Auto-expand sections if they have values
        if (data.utmSource || data.utmMedium || data.utmContent || data.utmTerm) setShowUTM(true);
        if (
          data.startsAt ||
          data.expiresAt ||
          data.maxClicks ||
          data.allowedCountries?.length ||
          data.redirectType === "PERMANENT"
        )
          setShowAdvanced(true);
      } catch {
        setError("Failed to load link");
      } finally {
        setLoading(false);
      }
    }
    fetchLink();
  }, [linkId]);

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
      // Drop empty / malformed variants before sending. Weights default to 1.
      const cleanedVariants = variants
        .map((v) => ({
          id: v.id || `v_${Math.random().toString(36).slice(2, 8)}`,
          url: v.url.trim(),
          weight: Number.isFinite(v.weight) && v.weight > 0 ? v.weight : 1,
          ...(v.label && v.label.trim() ? { label: v.label.trim() } : {}),
        }))
        .filter((v) => {
          try {
            new URL(v.url);
            return true;
          } catch {
            return false;
          }
        });

      const payload: Record<string, unknown> = {
        originalUrl,
        title: title || null,
        status,
        redirectType,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        maxClicks: maxClicks ? parseInt(maxClicks) : null,
        allowedCountries,
        variants: cleanedVariants,
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

      // Toast shows on the /links page after redirect (survives navigation
      // because <ToastProvider> lives in the shared dashboard layout).
      toast.success(t("updateSuccess"));
      router.push("/links");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update link");
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

          {/* A/B Variants */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-700">A/B variants</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Split traffic across alternate URLs. Leave empty to send all visitors to the primary URL above.
                  Weights are relative &mdash; e.g. 1 vs 1 = 50/50, 3 vs 1 = 75/25.
                </p>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {variants.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  No variants &mdash; everyone lands on the primary URL.
                </p>
              ) : (
                <div className="space-y-2">
                  {variants.map((v, idx) => {
                    const totalWeight = variants.reduce((s, x) => s + (x.weight || 0), 0) || 1;
                    const pct = Math.round(((v.weight || 0) / totalWeight) * 100);
                    return (
                      <div
                        key={v.id || idx}
                        className="flex items-center gap-2 p-3 bg-slate-50/70 border border-slate-200 rounded-lg"
                      >
                        <input
                          type="text"
                          value={v.label ?? ""}
                          onChange={(e) =>
                            setVariants(
                              variants.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)),
                            )
                          }
                          placeholder="Label (optional)"
                          className="w-32 px-2 py-1.5 text-sm border border-slate-200 rounded bg-white focus:ring-1 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
                        />
                        <input
                          type="url"
                          value={v.url}
                          onChange={(e) =>
                            setVariants(
                              variants.map((x, i) => (i === idx ? { ...x, url: e.target.value } : x)),
                            )
                          }
                          placeholder="https://example.com/landing-b"
                          className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-slate-200 rounded bg-white focus:ring-1 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
                        />
                        <input
                          type="number"
                          min="1"
                          value={v.weight}
                          onChange={(e) =>
                            setVariants(
                              variants.map((x, i) =>
                                i === idx ? { ...x, weight: parseInt(e.target.value, 10) || 1 } : x,
                              ),
                            )
                          }
                          className="w-16 px-2 py-1.5 text-sm border border-slate-200 rounded bg-white text-center tabular-nums focus:ring-1 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
                        />
                        <span className="text-xs text-slate-400 tabular-nums w-10 text-right">{pct}%</span>
                        <button
                          type="button"
                          onClick={() => setVariants(variants.filter((_, i) => i !== idx))}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          aria-label="Remove variant"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                onClick={() =>
                  setVariants([
                    ...variants,
                    {
                      id: `v_${Math.random().toString(36).slice(2, 8)}`,
                      url: "",
                      weight: 1,
                      label: "",
                    },
                  ])
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                + Add variant
              </button>
            </div>
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
                        <span className="text-xs text-slate-500">{t("redirect302")}</span>
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
                        <span className="text-xs text-slate-500">{t("redirect301")}</span>
                      </div>
                      {redirectType === "PERMANENT" && <CheckCircle className="w-5 h-5 text-[#03A9F4] ml-auto" />}
                    </label>
                  </div>
                </div>

                {/* Scheduled start */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Scheduled start
                  </label>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] transition-all"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Link is inactive until this time. Leave blank to activate immediately.
                  </p>
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

                {/* Allowed countries */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Geo restriction
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {allowedCountries.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-50 text-violet-700 border border-violet-200 rounded-full text-sm font-medium"
                      >
                        {c}
                        <button
                          type="button"
                          onClick={() => setAllowedCountries(allowedCountries.filter((x) => x !== c))}
                          className="text-violet-400 hover:text-violet-700"
                          aria-label={`Remove ${c}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {allowedCountries.length === 0 && (
                      <span className="text-xs text-slate-400 italic">
                        No restriction — link works worldwide
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={2}
                      value={newCountry}
                      onChange={(e) => setNewCountry(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          /^[A-Z]{2}$/.test(newCountry) &&
                          !allowedCountries.includes(newCountry)
                        ) {
                          e.preventDefault();
                          setAllowedCountries([...allowedCountries, newCountry]);
                          setNewCountry("");
                        }
                      }}
                      placeholder="ISO code (e.g. TW)"
                      className="flex-1 max-w-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-300 focus:border-violet-400 uppercase tracking-wider text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          /^[A-Z]{2}$/.test(newCountry) &&
                          !allowedCountries.includes(newCountry)
                        ) {
                          setAllowedCountries([...allowedCountries, newCountry]);
                          setNewCountry("");
                        }
                      }}
                      disabled={!/^[A-Z]{2}$/.test(newCountry)}
                      className="px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-40 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Use ISO 3166-1 alpha-2 codes (TW, US, JP, GB…). Non-matching visitors see a &quot;not available in your region&quot; page.
                  </p>
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
