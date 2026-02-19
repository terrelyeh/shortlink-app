"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  UTM_MEDIUMS,
  getSourcesForMedium,
  isCustomSourceAllowed,
} from "@/lib/utils/utm";
import {
  Plus,
  Edit,
  Trash2,
  X,
  Loader2,
  FileText,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";

interface Template {
  id: string;
  name: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  createdAt: string;
}

interface TemplateFormData {
  name: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
}

const emptyForm: TemplateFormData = {
  name: "",
  source: "",
  medium: "",
  campaign: "",
  content: "",
  term: "",
};

export default function TemplatesPage() {
  const t = useTranslations("utm");
  const tCommon = useTranslations("common");

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = async () => {
    try {
      const response = await fetch("/api/templates");
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openCreateForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setShowForm(true);
    setError(null);
  };

  const openEditForm = (template: Template) => {
    setFormData({
      name: template.name,
      source: template.source || "",
      medium: template.medium || "",
      campaign: template.campaign || "",
      content: template.content || "",
      term: template.term || "",
    });
    setEditingId(template.id);
    setShowForm(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const url = editingId ? `/api/templates/${editingId}` : "/api/templates";
      const method = editingId ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save template");
      }

      await fetchTemplates();
      setShowForm(false);
      setFormData(emptyForm);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("deleteTemplateConfirm"))) return;

    try {
      await fetch(`/api/templates/${id}`, { method: "DELETE" });
      setTemplates(templates.filter((t) => t.id !== id));
    } catch (error) {
      console.error("Failed to delete template:", error);
    }
  };

  // Build UTM tag pills for a template
  const getUtmPills = (template: Template) => {
    const pills: { label: string; value: string }[] = [];
    if (template.medium) pills.push({ label: "medium", value: template.medium });
    if (template.source) pills.push({ label: "source", value: template.source });
    if (template.campaign) pills.push({ label: "campaign", value: template.campaign });
    if (template.content) pills.push({ label: "content", value: template.content });
    if (template.term) pills.push({ label: "term", value: template.term });
    return pills;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("templates")}
        description={t("description")}
        actions={
          <button
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#03A9F4] text-white text-sm font-medium rounded-lg hover:bg-[#0288D1] transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("createTemplate")}
          </button>
        }
      />

      {/* Template List */}
      {templates.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-10 h-10" />}
          title={t("noTemplatesYet")}
          description={t("description")}
          action={{ label: t("createFirstTemplate"), onClick: openCreateForm }}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-100">
          {templates.map((template, index) => {
            const pills = getUtmPills(template);
            return (
              <div
                key={template.id}
                className={`flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 transition-colors ${
                  index > 0 ? "border-t border-slate-100" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{template.name}</p>
                  {pills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {pills.map((pill) => (
                        <span
                          key={pill.label}
                          className="inline-flex items-center text-xs text-slate-500 bg-slate-100 rounded px-1.5 py-0.5"
                        >
                          <span className="text-slate-400 mr-1">{pill.label}:</span>
                          {pill.value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Link
                    href={`/links/new?template=${template.id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#03A9F4] hover:bg-sky-50 rounded-md transition-colors"
                  >
                    {t("useTemplate")}
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                  <button
                    onClick={() => openEditForm(template)}
                    className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    <Edit className="w-4 h-4 text-slate-400" />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-1.5 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-500" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? t("editTemplate") : t("createTemplate")}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t("templateName")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Facebook Ads Q1"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t("medium")}
                    <span className="ml-1 text-xs text-slate-400 font-normal">
                      ({t("selectFirst")})
                    </span>
                  </label>
                  <div className="relative">
                    <select
                      value={formData.medium}
                      onChange={(e) => {
                        const newMedium = e.target.value;
                        const newSources = getSourcesForMedium(newMedium);
                        const newFormData = { ...formData, medium: newMedium };
                        if (
                          newSources.length > 0 &&
                          !newSources.includes(formData.source) &&
                          !isCustomSourceAllowed(newMedium)
                        ) {
                          newFormData.source = "";
                        }
                        setFormData(newFormData);
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] appearance-none bg-white"
                    >
                      <option value="">{t("mediumPlaceholder")}</option>
                      {UTM_MEDIUMS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t("source")}
                  </label>
                  <div className="relative">
                    <select
                      value={formData.source}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#03A9F4] appearance-none bg-white ${
                        !formData.medium
                          ? "border-slate-100 bg-slate-50 text-slate-400"
                          : "border-slate-200"
                      }`}
                      disabled={!formData.medium}
                    >
                      <option value="">
                        {!formData.medium ? t("selectMediumFirst") : t("sourcePlaceholder")}
                      </option>
                      {getSourcesForMedium(formData.medium).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                  {isCustomSourceAllowed(formData.medium) && (
                    <input
                      type="text"
                      value={formData.source}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                      placeholder={t("sourceCustomPlaceholder")}
                      className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] text-sm"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t("campaign")}
                </label>
                <input
                  type="text"
                  value={formData.campaign}
                  onChange={(e) => setFormData({ ...formData, campaign: e.target.value })}
                  placeholder={t("campaignPlaceholder")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t("content")}
                </label>
                <input
                  type="text"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder={t("contentPlaceholder")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t("term")}
                </label>
                <input
                  type="text"
                  value={formData.term}
                  onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                  placeholder={t("termPlaceholder")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  {tCommon("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#03A9F4] text-white rounded-lg hover:bg-[#0288D1] transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("savingTemplate")}
                    </>
                  ) : (
                    tCommon("save")
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
