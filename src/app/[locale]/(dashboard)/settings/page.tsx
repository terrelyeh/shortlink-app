"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { Globe, User, Check, Pencil, AlertTriangle } from "lucide-react";
import { useSession, signOut } from "next-auth/react";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, update: updateSession } = useSession();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(session?.user?.name || "");
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
    setIsDeleting(true);
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
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>

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
            <span className="text-gray-900">Next.js 15</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{t("database")}</span>
            <span className="text-gray-900">PostgreSQL</span>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
        <h2 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {t("dangerZone")}
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">{t("deleteAccount")}</p>
            <p className="text-sm text-gray-500 mt-1">
              {t("deleteAccountDesc")}
            </p>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 shrink-0"
          >
            {t("deleteAccount")}
          </button>
        </div>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 mb-4">
              {t("deleteAccountConfirm")}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "..." : t("deleteAccount")}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                {tCommon("cancel")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
