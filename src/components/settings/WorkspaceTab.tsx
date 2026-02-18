"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  Loader2,
  Building2,
  Save,
  Check,
} from "lucide-react";

interface WorkspaceData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  currentUserRole: string;
  _count: {
    members: number;
    shortLinks: number;
    campaigns: number;
    templates: number;
  };
}

export function WorkspaceTab() {
  const { currentWorkspace, hasPermission, refreshWorkspaces } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const t = useTranslations("workspace");
  const tCommon = useTranslations("common");

  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const canEdit = hasPermission("manage");

  const fetchWorkspace = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/workspaces/${workspaceId}`);
      if (!response.ok) {
        throw new Error("Failed to load workspace");
      }

      const data = await response.json();
      setWorkspace(data.workspace);
      setName(data.workspace.name);
      setSlug(data.workspace.slug);
      setDescription(data.workspace.description || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspace");
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);

    if (!name.trim()) {
      setSaveError("Workspace name is required");
      return;
    }

    if (!slug.trim() || !/^[a-z0-9-]+$/.test(slug)) {
      setSaveError("Slug must contain only lowercase letters, numbers, and hyphens");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save changes");
      }

      const data = await response.json();
      setWorkspace(prev => prev ? { ...prev, ...data.workspace } : null);
      setSaveSuccess(true);
      await refreshWorkspaces();

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p>No workspace selected</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <form onSubmit={handleSave} className="space-y-5">
          {saveError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
              {saveError}
            </div>
          )}
          {saveSuccess && (
            <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-green-700 text-sm flex items-center gap-2">
              <Check className="w-4 h-4" />
              Changes saved successfully
            </div>
          )}

          {/* Workspace Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              {t("workspaceName")} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("workspaceNamePlaceholder")}
              disabled={!canEdit}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] transition-all disabled:bg-slate-50 disabled:text-slate-500"
              maxLength={100}
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              {t("workspaceSlug")} <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">/workspace/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="my-team"
                disabled={!canEdit}
                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] transition-all font-mono disabled:bg-slate-50 disabled:text-slate-500"
                maxLength={50}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">{t("slugHint")}</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              {t("description")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              rows={3}
              disabled={!canEdit}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] transition-all resize-none disabled:bg-slate-50 disabled:text-slate-500"
              maxLength={500}
            />
          </div>

          {/* Stats */}
          {workspace?._count && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold text-slate-900">{workspace._count.members}</div>
                <div className="text-xs text-slate-500">{t("members")}</div>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold text-slate-900">{workspace._count.shortLinks}</div>
                <div className="text-xs text-slate-500">Links</div>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold text-slate-900">{workspace._count.campaigns}</div>
                <div className="text-xs text-slate-500">Campaigns</div>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold text-slate-900">{workspace._count.templates}</div>
                <div className="text-xs text-slate-500">Templates</div>
              </div>
            </div>
          )}

          {/* Save Button */}
          {canEdit && (
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-[#03A9F4] text-white rounded-xl hover:bg-[#0288D1] transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {tCommon("save")}...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    {tCommon("save")}
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
