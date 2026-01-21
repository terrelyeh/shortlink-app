"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Settings,
  ArrowLeft,
  Loader2,
  Building2,
  AlertTriangle,
  Trash2,
  Save,
  Check,
} from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";

type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

interface WorkspaceData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  currentUserRole: WorkspaceRole;
  _count: {
    members: number;
    shortLinks: number;
    campaigns: number;
    templates: number;
  };
}

export default function WorkspaceSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.id as string;
  const t = useTranslations("workspace");
  const tCommon = useTranslations("common");
  const { refreshWorkspaces } = useWorkspace();

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

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canEdit = workspace?.currentUserRole === "OWNER" || workspace?.currentUserRole === "ADMIN";
  const canDelete = workspace?.currentUserRole === "OWNER";

  const fetchWorkspace = useCallback(async () => {
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

  const handleDelete = async () => {
    if (deleteConfirmName !== workspace?.name) {
      setDeleteError("Workspace name does not match");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete workspace");
      }

      await refreshWorkspaces();
      router.push("/dashboard");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete workspace");
      setIsDeleting(false);
    }
  };

  const generateSlug = (value: string) => {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">{tCommon("back")}</span>
      </button>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 bg-gradient-to-br from-slate-600 to-slate-800 rounded-2xl flex items-center justify-center text-white">
          <Settings className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("settings")}</h1>
          <p className="text-slate-500">{workspace?.name}</p>
        </div>
      </div>

      {/* Settings Form */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-slate-400" />
          {t("title")}
        </h3>

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

      {/* Danger Zone */}
      {canDelete && (
        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
          <h3 className="text-lg font-semibold text-red-700 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            {t("dangerZone")}
          </h3>

          <div className="p-4 bg-red-50 rounded-lg">
            <h4 className="font-medium text-red-900 mb-1">{t("deleteWorkspace")}</h4>
            <p className="text-sm text-red-700 mb-4">{t("deleteWorkspaceDesc")}</p>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {t("deleteWorkspace")}
              </button>
            ) : (
              <div className="space-y-4">
                {deleteError && (
                  <div className="p-3 bg-red-100 border border-red-200 rounded-lg text-red-700 text-sm">
                    {deleteError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-red-800 mb-2">
                    {t("deleteWorkspaceConfirm")}
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    placeholder={workspace?.name}
                    className="w-full px-4 py-2 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmName("");
                      setDeleteError(null);
                    }}
                    className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    {tCommon("cancel")}
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting || deleteConfirmName !== workspace?.name}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    {tCommon("delete")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
