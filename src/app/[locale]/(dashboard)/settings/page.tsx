"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { Globe, User, Check, Pencil, AlertTriangle, Users, Building2, Trash2, Loader2 } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { MembersTab } from "@/components/settings/MembersTab";
import { WorkspaceTab } from "@/components/settings/WorkspaceTab";

type SettingsTab = "profile" | "members" | "workspace";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tWorkspace = useTranslations("workspace");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, update: updateSession } = useSession();
  const { currentWorkspace, refreshWorkspaces } = useWorkspace();

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  // Profile state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(session?.user?.name || "");
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Delete account state
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Delete workspace state
  const [showDeleteWorkspaceConfirm, setShowDeleteWorkspaceConfirm] = useState(false);
  const [deleteWorkspaceConfirmName, setDeleteWorkspaceConfirmName] = useState("");
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);
  const [deleteWorkspaceError, setDeleteWorkspaceError] = useState<string | null>(null);

  const isWorkspaceOwner = currentWorkspace?.role === "OWNER";

  const switchLocale = (newLocale: Locale) => {
    const segments = pathname.split("/");
    if (locales.includes(segments[1] as Locale)) {
      segments[1] = newLocale;
    } else {
      segments.splice(1, 0, newLocale);
    }
    const newPath = segments.join("/") || "/";
    router.push(newPath);
  };

  const handleEditProfile = () => {
    setEditName(session?.user?.name || "");
    setIsEditing(true);
    setSuccessMessage("");
    setErrorMessage("");
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName(session?.user?.name || "");
    setErrorMessage("");
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) return;

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update profile");
      }

      await updateSession();
      setIsEditing(false);
      setSuccessMessage(t("profileUpdated"));
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update profile"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/user/profile", {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete account");
      }

      await signOut({ callbackUrl: "/auth/signin" });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to delete account"
      );
      setIsDeletingAccount(false);
      setShowDeleteAccountConfirm(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (deleteWorkspaceConfirmName !== currentWorkspace?.name) {
      setDeleteWorkspaceError("Workspace name does not match");
      return;
    }

    setIsDeletingWorkspace(true);
    setDeleteWorkspaceError(null);

    try {
      const response = await fetch(`/api/workspaces/${currentWorkspace?.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete workspace");
      }

      await refreshWorkspaces();
      setShowDeleteWorkspaceConfirm(false);
      setDeleteWorkspaceConfirmName("");
      router.push("/dashboard");
    } catch (err) {
      setDeleteWorkspaceError(err instanceof Error ? err.message : "Failed to delete workspace");
      setIsDeletingWorkspace(false);
    }
  };

  const tabs = [
    { id: "profile" as const, label: t("profile"), icon: User },
    { id: "members" as const, label: tWorkspace("members"), icon: Users },
    { id: "workspace" as const, label: tWorkspace("title"), icon: Building2 },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 flex-1 justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {errorMessage}
        </div>
      )}

      {/* ===== Profile Tab ===== */}
      {activeTab === "profile" && (
        <>
          {/* Profile Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5" />
                {t("profile")}
              </h2>
              {!isEditing && (
                <button
                  onClick={handleEditProfile}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Pencil className="w-4 h-4" />
                  {t("editProfile")}
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || ""}
                  className="w-16 h-16 rounded-full"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-2xl font-medium text-gray-600">
                    {session?.user?.name?.charAt(0) || "U"}
                  </span>
                </div>
              )}
              <div className="flex-1">
                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label
                        htmlFor="displayName"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        {t("displayName")}
                      </label>
                      <input
                        id="displayName"
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        placeholder={t("displayName")}
                        disabled={isSaving}
                      />
                    </div>
                    <p className="text-sm text-gray-500">{session?.user?.email}</p>
                    <p className="text-xs text-gray-400 capitalize">
                      {t("role")}: {session?.user?.role?.toLowerCase()}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveProfile}
                        disabled={isSaving || !editName.trim()}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSaving ? t("saving") : t("saveChanges")}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                        className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50"
                      >
                        {tCommon("cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium text-gray-900">
                      {session?.user?.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {session?.user?.email}
                    </p>
                    <p className="text-xs text-gray-400 capitalize mt-1">
                      {t("role")}: {session?.user?.role?.toLowerCase()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Language Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5" />
              {t("language")}
            </h2>

            <div className="grid grid-cols-2 gap-3">
              {locales.map((loc) => (
                <button
                  key={loc}
                  onClick={() => switchLocale(loc)}
                  className={`flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${
                    loc === locale
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span
                    className={`font-medium ${
                      loc === locale ? "text-blue-700" : "text-gray-700"
                    }`}
                  >
                    {localeNames[loc]}
                  </span>
                  {loc === locale && (
                    <Check className="w-5 h-5 text-blue-600" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* App Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {t("about")}
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t("version")}</span>
                <span className="text-gray-900">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t("framework")}</span>
                <span className="text-gray-900">Next.js 16</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t("database")}</span>
                <span className="text-gray-900">PostgreSQL</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== Members Tab ===== */}
      {activeTab === "members" && <MembersTab />}

      {/* ===== Workspace Tab ===== */}
      {activeTab === "workspace" && <WorkspaceTab />}

      {/* ===== Danger Zone (always visible) ===== */}
      <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
        <h2 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {t("dangerZone")}
        </h2>

        <div className="space-y-4">
          {/* Delete Account */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{t("deleteAccount")}</p>
              <p className="text-sm text-gray-500 mt-1">
                {t("deleteAccountDesc")}
              </p>
            </div>
            <button
              onClick={() => setShowDeleteAccountConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 shrink-0"
            >
              {t("deleteAccount")}
            </button>
          </div>

          {showDeleteAccountConfirm && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 mb-4">
                {t("deleteAccountConfirm")}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeletingAccount ? "..." : t("deleteAccount")}
                </button>
                <button
                  onClick={() => setShowDeleteAccountConfirm(false)}
                  disabled={isDeletingAccount}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  {tCommon("cancel")}
                </button>
              </div>
            </div>
          )}

          {/* Delete Workspace - only for workspace owners */}
          {isWorkspaceOwner && currentWorkspace && (
            <>
              <div className="border-t border-red-100 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{tWorkspace("deleteWorkspace")}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {tWorkspace("deleteWorkspaceDesc")}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDeleteWorkspaceConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                    {tWorkspace("deleteWorkspace")}
                  </button>
                </div>

                {showDeleteWorkspaceConfirm && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg space-y-4">
                    {deleteWorkspaceError && (
                      <div className="p-3 bg-red-100 border border-red-200 rounded-lg text-red-700 text-sm">
                        {deleteWorkspaceError}
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-red-800 mb-2">
                        {tWorkspace("deleteWorkspaceConfirm")}
                      </label>
                      <input
                        type="text"
                        value={deleteWorkspaceConfirmName}
                        onChange={(e) => setDeleteWorkspaceConfirmName(e.target.value)}
                        placeholder={currentWorkspace.name}
                        className="w-full px-4 py-2 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleDeleteWorkspace}
                        disabled={isDeletingWorkspace || deleteWorkspaceConfirmName !== currentWorkspace.name}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDeletingWorkspace ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        {tCommon("delete")}
                      </button>
                      <button
                        onClick={() => {
                          setShowDeleteWorkspaceConfirm(false);
                          setDeleteWorkspaceConfirmName("");
                          setDeleteWorkspaceError(null);
                        }}
                        disabled={isDeletingWorkspace}
                        className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50"
                      >
                        {tCommon("cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
