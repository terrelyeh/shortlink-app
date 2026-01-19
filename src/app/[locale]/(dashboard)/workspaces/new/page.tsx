"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2, Loader2, ArrowLeft, Check } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export default function NewWorkspacePage() {
  const router = useRouter();
  const t = useTranslations("workspace");
  const { refreshWorkspaces } = useWorkspace();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value);
    // Only auto-generate if user hasn't manually edited slug
    if (!slug || slug === generateSlug(name)) {
      setSlug(generateSlug(value));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Workspace name is required");
      return;
    }

    if (!slug.trim() || !/^[a-z0-9-]+$/.test(slug)) {
      setError("Slug must contain only lowercase letters, numbers, and hyphens");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create workspace");
      }

      // Refresh workspaces list
      await refreshWorkspaces();

      // Redirect to dashboard
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workspace");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back</span>
      </button>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-white">
          <Building2 className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("createWorkspace")}</h1>
          <p className="text-slate-500">{t("createWorkspaceDesc")}</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
            {error}
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
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={t("workspaceNamePlaceholder")}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
            maxLength={100}
            required
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
              className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all font-mono"
              maxLength={50}
              required
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
            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all resize-none"
            maxLength={500}
          />
        </div>

        {/* Info Box */}
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-violet-900 mb-2">
            {t("whatHappensNext")}
          </h3>
          <ul className="space-y-2 text-sm text-violet-700">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{t("nextStep1")}</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{t("nextStep2")}</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{t("nextStep3")}</span>
            </li>
          </ul>
        </div>

        {/* Submit Button */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all font-medium"
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl hover:from-violet-600 hover:to-purple-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t("creating")}
              </>
            ) : (
              <>
                <Building2 className="w-5 h-5" />
                {t("createWorkspace")}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
