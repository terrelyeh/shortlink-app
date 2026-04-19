"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  ChevronDown,
  FileText,
  Loader2,
  AlertCircle,
  Info,
  X,
  Plus,
  Megaphone,
  Sparkles,
} from "lucide-react";

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
  content: string | null;
  term: string | null;
}

interface UTMBuilderProps {
  values: UTMParams;
  onChange: (values: UTMParams) => void;
  originalUrl: string;
  campaignLocked?: boolean; // When a Campaign entity is selected, lock the campaign field
}

type ExistingCampaign = {
  name: string;
  displayName: string | null;
  status: string | null;
  defaultSource: string | null;
  defaultMedium: string | null;
};

export function UTMBuilder({ values, onChange, originalUrl, campaignLocked }: UTMBuilderProps) {
  const t = useTranslations("utm");
  const qc = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  // All three fetches are React Query-backed. Keys are shared with the
  // Templates page / Settings page / campaign combobox on other routes
  // so cache hits are instant when the builder mounts after visiting
  // those pages.
  const { data: templatesData, isFetching: loadingTemplates } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const response = await fetch("/api/templates");
      if (!response.ok) throw new Error("Failed to load templates");
      return (await response.json()) as UTMTemplate[];
    },
  });
  const templates = useMemo(() => templatesData ?? [], [templatesData]);

  const { data: utmSettings } = useQuery({
    queryKey: ["workspace-utm-settings"],
    queryFn: async () => {
      const res = await fetch("/api/workspace/utm-settings");
      if (!res.ok) return { approvedSources: [] as string[], approvedMediums: [] as string[] };
      return (await res.json()) as { approvedSources: string[]; approvedMediums: string[] };
    },
  });
  const approvedSources = useMemo(
    () => utmSettings?.approvedSources ?? [],
    [utmSettings],
  );
  const approvedMediums = useMemo(
    () => utmSettings?.approvedMediums ?? [],
    [utmSettings],
  );

  const { data: campaignsData } = useQuery({
    queryKey: ["utm-campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/campaigns");
      if (!res.ok) return { campaigns: [] as ExistingCampaign[] };
      return (await res.json()) as { campaigns: ExistingCampaign[] };
    },
  });
  // Local overlay for newly-created campaigns so the combobox shows them
  // immediately — onCreated also invalidates the "utm-campaigns" key so
  // the server truth takes over on the next fetch.
  const [newlyCreated, setNewlyCreated] = useState<ExistingCampaign[]>([]);
  const existingCampaigns = useMemo(() => {
    const fromServer: ExistingCampaign[] = (campaignsData?.campaigns ?? []).map((c) => ({
      name: c.name,
      displayName: c.displayName,
      status: c.status,
      defaultSource: c.defaultSource,
      defaultMedium: c.defaultMedium,
    }));
    const names = new Set(fromServer.map((c) => c.name));
    for (const c of newlyCreated) if (!names.has(c.name)) fromServer.unshift(c);
    return fromServer;
  }, [campaignsData, newlyCreated]);
  const setExistingCampaigns = (
    updater: (prev: ExistingCampaign[]) => ExistingCampaign[],
  ) => {
    setNewlyCreated((prev) => {
      const next = updater([...prev]);
      const serverNames = new Set(
        (campaignsData?.campaigns ?? []).map((c) => c.name),
      );
      return next.filter((c) => !serverNames.has(c.name));
    });
  };

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

    // When campaign value matches an existing Campaign row (i.e. user picked
    // from the datalist rather than typing a new name), pull in its default
    // source / medium. Only fills fields that are CURRENTLY EMPTY so we
    // never overwrite what the user already typed.
    if (field === "utmCampaign" && value) {
      const picked = existingCampaigns.find((c) => c.name === value.trim());
      if (picked) {
        if (!newValues.utmSource && picked.defaultSource) {
          newValues.utmSource = picked.defaultSource;
        }
        if (!newValues.utmMedium && picked.defaultMedium) {
          newValues.utmMedium = picked.defaultMedium;
        }
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
      // Templates carry channel-level defaults only. utm_campaign is
      // intentionally preserved from whatever the user already has set
      // (or left empty) — campaign is always per-link, not per-template.
      onChange({
        ...values,
        utmSource: template.source || "",
        utmMedium: template.medium || "",
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
        {/* Campaign — the most important field on this form. Promoted to
            full-width and the first position so new users clock it first. */}
        <div className="md:col-span-2">
          <details className="group mb-2 bg-violet-50 border border-violet-100 rounded-lg">
            <summary className="flex items-center gap-2 p-3 cursor-pointer list-none">
              <Megaphone className="w-4 h-4 text-violet-500 shrink-0" />
              <span className="text-xs font-medium text-violet-900 flex-1">
                Campaign 是這條 link 的管理依據
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-violet-500 transition-transform group-open:rotate-180 shrink-0" />
            </summary>
            <p className="px-3 pb-3 pl-9 text-xs text-violet-700/80 leading-relaxed">
              這個值決定 link 之後歸到哪個活動 — 影響 Campaigns
              列表、目標追蹤、和跨活動比較。留空的 link 只會出現在孤兒區。
            </p>
          </details>
          <label className="flex items-center text-sm font-medium text-slate-700 mb-1">
            {t("campaign")}
            {campaignLocked && (
              <span className="ml-1.5 text-[10px] text-violet-500 font-normal bg-violet-50 px-1.5 py-0.5 rounded">
                from Campaign
              </span>
            )}
            <FieldHint text={t("campaignTip")} />
          </label>
          <CampaignCombobox
            value={values.utmCampaign}
            onChange={(v) => handleChange("utmCampaign", v)}
            existingCampaigns={existingCampaigns}
            onCreated={(c) => {
              setExistingCampaigns((prev) => [c, ...prev.filter((x) => x.name !== c.name)]);
              qc.invalidateQueries({ queryKey: ["utm-campaigns"] });
              qc.invalidateQueries({ queryKey: ["campaigns-summary"] });
            }}
            readOnly={campaignLocked}
            placeholder={t("campaignPlaceholder")}
          />
          {!campaignLocked && values.utmCampaign && (
            <p className="mt-1 text-xs">
              {existingCampaigns.some((c) => c.name === values.utmCampaign.trim()) ? (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <Sparkles className="w-3 h-3" /> 歸到現有活動
                </span>
              ) : (
                <span className="text-slate-500">
                  新活動 — 儲存時自動建立
                </span>
              )}
            </p>
          )}
          {!campaignLocked && !values.utmCampaign && (
            <p className="mt-1 text-xs text-slate-400">
              留空這條 link 不會出現在 Campaigns 列表
            </p>
          )}
        </div>

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

interface CampaignComboboxItem {
  name: string;
  displayName: string | null;
  status: string | null;
  defaultSource: string | null;
  defaultMedium: string | null;
}

/**
 * Custom combobox for the campaign field. Replaces a native <datalist>
 * so the "create new campaign" action is a first-class option visible
 * in the dropdown — not an invisible side-effect of typing + saving.
 * Pattern mirrors Linear / Slack / Notion quick-pickers.
 */
function CampaignCombobox({
  value,
  onChange,
  existingCampaigns,
  onCreated,
  readOnly,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  existingCampaigns: CampaignComboboxItem[];
  onCreated: (c: CampaignComboboxItem) => void;
  readOnly?: boolean;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const trimmed = value.trim();
  const matchesExisting = existingCampaigns.some((c) => c.name === trimmed);
  const filtered = useMemo(() => {
    const q = trimmed.toLowerCase();
    if (!q) return existingCampaigns;
    return existingCampaigns.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.displayName && c.displayName.toLowerCase().includes(q)),
    );
  }, [existingCampaigns, trimmed]);

  // The "create new" row is always visible in the dropdown UNLESS the
  // input exactly matches an existing campaign (picking mode, not creating).
  // When the input is empty it's rendered inert as a hint so users still
  // see the capability exists without typing first.
  const showCreateOption = !matchesExisting;
  const createIsActionable = showCreateOption && !!trimmed;
  const totalItems = (createIsActionable ? 1 : 0) + filtered.length;

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Reset highlight when dropdown contents change
  useEffect(() => {
    setHighlighted(0);
  }, [trimmed, isOpen]);

  const handleCreate = async () => {
    if (!trimmed || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      // The name regex on the API side is strict — lowercase letters,
      // numbers, underscore, hyphen. If users type anything else we
      // let the API reject and surface the message inline.
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, status: "ACTIVE" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Zod validation errors come back as an array under `error`.
        const msg =
          typeof data.error === "string"
            ? data.error
            : Array.isArray(data.error)
              ? data.error[0]?.message ?? "Invalid name"
              : "Failed to create campaign";
        throw new Error(msg);
      }
      const created = await res.json();
      const newItem: CampaignComboboxItem = {
        name: created.name,
        displayName: created.displayName ?? null,
        status: created.status ?? "ACTIVE",
        defaultSource: created.defaultSource ?? null,
        defaultMedium: created.defaultMedium ?? null,
      };
      onCreated(newItem);
      onChange(newItem.name);
      setIsOpen(false);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed");
    } finally {
      setCreating(false);
    }
  };

  const pickExisting = (name: string) => {
    onChange(name);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (readOnly) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setHighlighted((h) => Math.min(h + 1, Math.max(0, totalItems - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter" && isOpen && totalItems > 0) {
      e.preventDefault();
      if (createIsActionable && highlighted === 0) {
        handleCreate();
      } else {
        const idx = createIsActionable ? highlighted - 1 : highlighted;
        const picked = filtered[idx];
        if (picked) pickExisting(picked.name);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
          setCreateError(null);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        readOnly={readOnly}
        placeholder={placeholder}
        autoComplete="off"
        className={`w-full px-3 py-2 pr-9 border rounded-lg ${
          readOnly
            ? "border-violet-200 bg-violet-50/50 text-violet-700 cursor-not-allowed"
            : "border-slate-200 bg-white focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
        }`}
      />
      {!readOnly &&
        (value ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            aria-label="Clear campaign"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            aria-hidden="true"
          />
        ))}

      {isOpen && !readOnly && (
        <div
          ref={dropdownRef}
          className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-72 overflow-y-auto py-1"
        >
          {showCreateOption &&
            (createIsActionable ? (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  highlighted === 0
                    ? "bg-violet-50 text-violet-700"
                    : "text-violet-600 hover:bg-violet-50"
                } disabled:opacity-60`}
                onMouseEnter={() => setHighlighted(0)}
              >
                {creating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>
                  建立新活動{" "}
                  <span className="font-mono font-medium">&apos;{trimmed}&apos;</span>
                </span>
              </button>
            ) : (
              <div
                className="flex items-center gap-2 px-3 py-2 text-sm text-violet-400 cursor-default"
                onClick={() => inputRef.current?.focus()}
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>輸入活動名稱以建立</span>
              </div>
            ))}

          {filtered.length > 0 && (
            <>
              {showCreateOption && <div className="my-1 border-t border-slate-100" />}
              <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                現有活動
              </div>
              {filtered.map((c, i) => {
                const idx = createIsActionable ? i + 1 : i;
                const isHighlighted = idx === highlighted;
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => pickExisting(c.name)}
                    onMouseEnter={() => setHighlighted(idx)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                      isHighlighted ? "bg-slate-50" : ""
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        c.status === "ACTIVE"
                          ? "bg-emerald-400"
                          : c.status === "DRAFT"
                            ? "bg-slate-300"
                            : "bg-amber-400"
                      }`}
                    />
                    <span className="font-mono text-sm text-slate-700">{c.name}</span>
                    {c.displayName && (
                      <span className="text-xs text-slate-400 truncate">
                        — {c.displayName}
                      </span>
                    )}
                    {(c.defaultSource || c.defaultMedium) && (
                      <span className="ml-auto flex items-center gap-1">
                        {c.defaultSource && (
                          <span className="px-1 py-0.5 bg-cyan-50 text-cyan-600 rounded text-[10px] font-mono">
                            {c.defaultSource}
                          </span>
                        )}
                        {c.defaultMedium && (
                          <span className="px-1 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] font-mono">
                            {c.defaultMedium}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          )}

          {filtered.length === 0 && !showCreateOption && (
            <div className="px-3 py-4 text-center text-sm text-slate-400">
              尚無活動
            </div>
          )}
        </div>
      )}

      {createError && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {createError}
        </p>
      )}
    </div>
  );
}
