"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Edit,
  Trash2,
  X,
  Loader2,
  Megaphone,
  Search,
  Filter,
  Calendar,
  Link2,
  Tag,
  ChevronDown,
  Eye,
  Archive,
  Play,
  Pause,
  CheckCircle,
} from "lucide-react";

interface CampaignTag {
  id: string;
  name: string;
  color: string | null;
}

interface Campaign {
  id: string;
  name: string;
  displayName: string | null;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  startDate: string | null;
  endDate: string | null;
  defaultSource: string | null;
  defaultMedium: string | null;
  tags: CampaignTag[];
  linkCount: number;
  createdAt: string;
}

interface CampaignFormData {
  name: string;
  displayName: string;
  description: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  startDate: string;
  endDate: string;
  defaultSource: string;
  defaultMedium: string;
  tags: string[];
}

const emptyForm: CampaignFormData = {
  name: "",
  displayName: "",
  description: "",
  status: "ACTIVE",
  startDate: "",
  endDate: "",
  defaultSource: "",
  defaultMedium: "",
  tags: [],
};

const statusConfig = {
  DRAFT: { label: "Draft", color: "bg-slate-100 text-slate-700", icon: Pause },
  ACTIVE: { label: "Active", color: "bg-emerald-100 text-emerald-700", icon: Play },
  COMPLETED: { label: "Completed", color: "bg-blue-100 text-blue-700", icon: CheckCircle },
  ARCHIVED: { label: "Archived", color: "bg-slate-100 text-slate-500", icon: Archive },
};

export default function CampaignsPage() {
  const t = useTranslations("campaigns");
  const tCommon = useTranslations("common");

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [allTags, setAllTags] = useState<CampaignTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CampaignFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [showArchived, setShowArchived] = useState(false);

  // New tag input
  const [newTag, setNewTag] = useState("");

  const fetchCampaigns = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (statusFilter) params.set("status", statusFilter);
      if (tagFilter) params.set("tagId", tagFilter);
      if (showArchived) params.set("includeArchived", "true");

      const response = await fetch(`/api/campaigns?${params}`);
      const data = await response.json();
      setCampaigns(data.campaigns || []);
      setAllTags(data.tags || []);
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [searchQuery, statusFilter, tagFilter, showArchived]);

  const openCreateForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setShowForm(true);
    setError(null);
  };

  const openEditForm = (campaign: Campaign) => {
    setFormData({
      name: campaign.name,
      displayName: campaign.displayName || "",
      description: campaign.description || "",
      status: campaign.status,
      startDate: campaign.startDate ? campaign.startDate.split("T")[0] : "",
      endDate: campaign.endDate ? campaign.endDate.split("T")[0] : "",
      defaultSource: campaign.defaultSource || "",
      defaultMedium: campaign.defaultMedium || "",
      tags: campaign.tags.map((t) => t.name),
    });
    setEditingId(campaign.id);
    setShowForm(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const url = editingId ? `/api/campaigns/${editingId}` : "/api/campaigns";
      const method = editingId ? "PATCH" : "POST";

      const payload = {
        ...formData,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save campaign");
      }

      await fetchCampaigns();
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
    if (!confirm(t("deleteConfirm"))) return;

    try {
      await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      setCampaigns(campaigns.filter((c) => c.id !== id));
    } catch (error) {
      console.error("Failed to delete campaign:", error);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const response = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        await fetchCampaigns();
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim().toLowerCase().replace(/\s+/g, "-")],
      });
      setNewTag("");
    }
  };

  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((t) => t !== tag),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#03A9F4]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("subtitle")}</p>
        </div>
        <button
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#03A9F4] text-white rounded-xl hover:bg-[#0288D1] transition-all shadow-sm"
        >
          <Plus className="w-5 h-5" />
          {t("createCampaign")}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-9 pr-8 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] appearance-none bg-white min-w-[140px]"
            >
              <option value="">{t("allStatuses")}</option>
              <option value="DRAFT">{t("statusDraft")}</option>
              <option value="ACTIVE">{t("statusActive")}</option>
              <option value="COMPLETED">{t("statusCompleted")}</option>
              <option value="ARCHIVED">{t("statusArchived")}</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Tag Filter */}
          {allTags.length > 0 && (
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="pl-9 pr-8 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] appearance-none bg-white min-w-[140px]"
              >
                <option value="">{t("allTags")}</option>
                {allTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          )}

          {/* Show Archived Toggle */}
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-[#03A9F4] focus:ring-[#03A9F4]"
            />
            {t("showArchived")}
          </label>
        </div>
      </div>

      {/* Campaign List */}
      {campaigns.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center shadow-sm">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-sky-50 to-sky-100 rounded-2xl flex items-center justify-center mb-4">
            <Megaphone className="w-8 h-8 text-[#03A9F4]" />
          </div>
          <p className="text-slate-500 mb-4">{t("noCampaigns")}</p>
          <button
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#03A9F4] text-white rounded-lg hover:bg-[#0288D1] transition-colors"
          >
            <Plus className="w-5 h-5" />
            {t("createFirst")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {campaigns.map((campaign) => {
            const StatusIcon = statusConfig[campaign.status].icon;
            return (
              <div
                key={campaign.id}
                className="bg-white border border-slate-100 rounded-xl p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900">
                        {campaign.displayName || campaign.name}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          statusConfig[campaign.status].color
                        }`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {t(`status${campaign.status.charAt(0)}${campaign.status.slice(1).toLowerCase()}`)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 font-mono">utm_campaign={campaign.name}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditForm(campaign)}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                      title={tCommon("edit")}
                    >
                      <Edit className="w-4 h-4 text-slate-500" />
                    </button>
                    <button
                      onClick={() => handleDelete(campaign.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title={tCommon("delete")}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>

                {campaign.description && (
                  <p className="text-sm text-slate-600 mb-3">{campaign.description}</p>
                )}

                {/* Tags */}
                {campaign.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {campaign.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs"
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Stats & Dates */}
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Link2 className="w-4 h-4" />
                    <span>{campaign.linkCount} {t("links")}</span>
                  </div>
                  {(campaign.startDate || campaign.endDate) && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {campaign.startDate
                          ? new Date(campaign.startDate).toLocaleDateString()
                          : "..."}{" "}
                        -{" "}
                        {campaign.endDate
                          ? new Date(campaign.endDate).toLocaleDateString()
                          : "..."}
                      </span>
                    </div>
                  )}
                </div>

                {/* Quick Status Actions */}
                {campaign.status !== "ARCHIVED" && (
                  <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                    {campaign.status === "DRAFT" && (
                      <button
                        onClick={() => handleStatusChange(campaign.id, "ACTIVE")}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                      >
                        <Play className="w-4 h-4" />
                        {t("activate")}
                      </button>
                    )}
                    {campaign.status === "ACTIVE" && (
                      <button
                        onClick={() => handleStatusChange(campaign.id, "COMPLETED")}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {t("markComplete")}
                      </button>
                    )}
                    <button
                      onClick={() => handleStatusChange(campaign.id, "ARCHIVED")}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <Archive className="w-4 h-4" />
                      {t("archive")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? t("editCampaign") : t("createCampaign")}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-5">
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Name (slug) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t("name")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      name: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                    })
                  }
                  placeholder="spring_sale_2026"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] font-mono text-sm"
                  required
                  pattern="^[a-z0-9_-]+$"
                />
                <p className="text-xs text-slate-500 mt-1">{t("nameHint")}</p>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t("displayName")}
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder={t("displayNamePlaceholder")}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t("description")}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t("descriptionPlaceholder")}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] resize-none"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t("status")}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"] as const).map((status) => {
                    const config = statusConfig[status];
                    const Icon = config.icon;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setFormData({ ...formData, status })}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                          formData.status === status
                            ? "border-[#03A9F4] bg-sky-50"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${formData.status === status ? "text-[#03A9F4]" : "text-slate-400"}`} />
                        <span className={`text-xs font-medium ${formData.status === status ? "text-[#0288D1]" : "text-slate-600"}`}>
                          {t(`status${status.charAt(0)}${status.slice(1).toLowerCase()}`)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t("startDate")}
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t("endDate")}
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
                  />
                </div>
              </div>

              {/* Default UTM Values */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t("defaultSource")}
                  </label>
                  <input
                    type="text"
                    value={formData.defaultSource}
                    onChange={(e) => setFormData({ ...formData, defaultSource: e.target.value })}
                    placeholder="facebook"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t("defaultMedium")}
                  </label>
                  <input
                    type="text"
                    value={formData.defaultMedium}
                    onChange={(e) => setFormData({ ...formData, defaultMedium: e.target.value })}
                    placeholder="cpc"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t("tags")}
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-100 text-[#0288D1] rounded-lg text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-sky-900"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder={t("addTagPlaceholder")}
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] text-sm"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors text-sm font-medium"
                  >
                    {t("addTag")}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors font-medium"
                >
                  {tCommon("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#03A9F4] text-white rounded-xl hover:bg-[#0288D1] transition-all font-medium disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("saving")}
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
