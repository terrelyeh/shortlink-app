"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { locales, localeNames, type Locale } from "@/i18n/config";
import {
  Globe,
  User,
  Check,
  Pencil,
  AlertTriangle,
  Users,
  Building2,
  Trash2,
  Loader2,
  ShieldCheck,
  Plus,
  X as XIcon,
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { MembersTab } from "@/components/settings/MembersTab";
import { WorkspaceTab } from "@/components/settings/WorkspaceTab";
import { PageHeader } from "@/components/layout/PageHeader";

type SettingsTab = "profile" | "members" | "workspace" | "governance";

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

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(session?.user?.name || "");
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const [showDeleteWorkspaceConfirm, setShowDeleteWorkspaceConfirm] = useState(false);
  const [deleteWorkspaceConfirmName, setDeleteWorkspaceConfirmName] = useState("");
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);
  const [deleteWorkspaceError, setDeleteWorkspaceError] = useState<string | null>(null);

  const isWorkspaceOwner = currentWorkspace?.role === "OWNER";
  const isAdminOrManager = ["ADMIN", "MANAGER"].includes(session?.user?.role || "");

  const [approvedSources, setApprovedSources] = useState<string[]>([]);
  const [approvedMediums, setApprovedMediums] = useState<string[]>([]);
  const [newSource, setNewSource] = useState("");
  const [newMedium, setNewMedium] = useState("");
  const [governanceLoading, setGovernanceLoading] = useState(false);
  const [governanceSaving, setGovernanceSaving] = useState(false);
  const [governanceSaved, setGovernanceSaved] = useState(false);

  useEffect(() => {
    if (activeTab === "governance" && currentWorkspace?.id) {
      setGovernanceLoading(true);
      fetch("/api/workspace/utm-settings")
        .then((r) => r.json())
        .then((data) => {
          setApprovedSources(data.approvedSources || []);
          setApprovedMediums(data.approvedMediums || []);
        })
        .catch(console.error)
        .finally(() => setGovernanceLoading(false));
    }
  }, [activeTab, currentWorkspace?.id]);

  const saveGovernanceSettings = async () => {
    setGovernanceSaving(true);
    try {
      const response = await fetch("/api/workspace/utm-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvedSources, approvedMediums }),
      });
      if (response.ok) {
        setGovernanceSaved(true);
        setTimeout(() => setGovernanceSaved(false), 2500);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGovernanceSaving(false);
    }
  };

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
      setErrorMessage(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/user/profile", { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete account");
      }
      await signOut({ callbackUrl: "/auth/signin" });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete account");
      setIsDeletingAccount(false);
      setShowDeleteAccountConfirm(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (deleteWorkspaceConfirmName !== currentWorkspace?.name) {
      setDeleteWorkspaceError(t("workspaceNameMismatch"));
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
      router.push("/campaigns");
    } catch (err) {
      setDeleteWorkspaceError(err instanceof Error ? err.message : "Failed to delete workspace");
      setIsDeletingWorkspace(false);
    }
  };

  const tabs = [
    { id: "profile" as const, label: t("profile"), icon: User },
    { id: "members" as const, label: tWorkspace("members"), icon: Users },
    { id: "workspace" as const, label: tWorkspace("title"), icon: Building2 },
    ...(isAdminOrManager && currentWorkspace
      ? [{ id: "governance" as const, label: "UTM Rules", icon: ShieldCheck }]
      : []),
  ];

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />

      {/* Tab navigation */}
      <div className="segmented" style={{ padding: 3, marginBottom: 18 }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={activeTab === tab.id ? "active" : ""}
              onClick={() => setActiveTab(tab.id)}
              style={{ padding: "8px 18px", fontSize: 12.5 }}
            >
              <Icon size={13} /> <span style={{ marginLeft: 6 }}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {successMessage && (
        <div
          className="card card-padded"
          style={{ background: "var(--ok-bg)", borderColor: "#CCE9D6", color: "var(--ok-fg)", marginBottom: 14 }}
        >
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div
          className="card card-padded"
          style={{ background: "var(--err-bg)", borderColor: "#F3C5CC", color: "var(--err-fg)", marginBottom: 14 }}
        >
          {errorMessage}
        </div>
      )}

      <div style={{ maxWidth: 720 }}>
        {/* Profile tab */}
        {activeTab === "profile" && (
          <>
            <div className="card card-padded" style={{ marginBottom: 12 }}>
              <div className="row-between">
                <div className="section-title">
                  <User size={14} style={{ color: "var(--ink-400)" }} /> {t("profile")}
                </div>
                {!isEditing && (
                  <button
                    className="btn btn-ghost"
                    onClick={handleEditProfile}
                    style={{ color: "var(--brand-600)" }}
                  >
                    <Pencil size={12} /> {t("editProfile")}
                  </button>
                )}
              </div>

              <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || ""}
                    style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 10,
                      background: "var(--bg-subtle)",
                      color: "var(--ink-300)",
                      fontSize: 22,
                      fontWeight: 500,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {session?.user?.name?.charAt(0) || "U"}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  {isEditing ? (
                    <>
                      <div className="field" style={{ marginBottom: 8 }}>
                        <div className="field-label">{t("displayName")}</div>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="input"
                          placeholder={t("displayName")}
                          disabled={isSaving}
                        />
                      </div>
                      <p style={{ fontSize: 12, color: "var(--ink-400)", margin: "6px 0 0" }}>
                        {session?.user?.email}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--ink-500)", margin: "2px 0 12px", textTransform: "capitalize" }}>
                        {t("role")}: {(currentWorkspace?.role ?? session?.user?.role ?? "").toLowerCase()}
                      </p>
                      <div className="row" style={{ gap: 8 }}>
                        <button
                          className="btn btn-primary"
                          onClick={handleSaveProfile}
                          disabled={isSaving || !editName.trim()}
                        >
                          {isSaving ? t("saving") : t("saveChanges")}
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                        >
                          {tCommon("cancel")}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-100)" }}>
                        {session?.user?.name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-400)" }}>{session?.user?.email}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 2, textTransform: "capitalize" }}>
                        {t("role")}: {(currentWorkspace?.role ?? session?.user?.role ?? "").toLowerCase()}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="card card-padded" style={{ marginBottom: 12 }}>
              <div className="section-title">
                <Globe size={14} style={{ color: "var(--ink-400)" }} /> {t("language")}
              </div>
              <div className="radio-cards" style={{ marginTop: 12 }}>
                {locales.map((loc) => (
                  <div
                    key={loc}
                    className={`radio-card ${loc === locale ? "selected" : ""}`}
                    onClick={() => switchLocale(loc)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="radio-dot" />
                      <span style={{ fontWeight: 500 }}>{localeNames[loc]}</span>
                    </div>
                    {loc === locale && <Check size={14} style={{ color: "var(--brand-600)" }} />}
                  </div>
                ))}
              </div>
            </div>

            <div className="card card-padded" style={{ marginBottom: 12 }}>
              <div className="section-title">{t("about")}</div>
              <div style={{ marginTop: 10 }}>
                {[
                  { k: t("version"), v: "1.0.0" },
                  { k: t("framework"), v: "Next.js 16" },
                  { k: t("database"), v: "PostgreSQL" },
                ].map((r, i) => (
                  <div
                    key={r.k}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "10px 0",
                      borderTop: i === 0 ? "none" : "1px solid var(--border)",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: "var(--ink-400)" }}>{r.k}</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-200)" }}>
                      {r.v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === "members" && <MembersTab />}
        {activeTab === "workspace" && <WorkspaceTab />}

        {/* UTM Governance */}
        {activeTab === "governance" && (
          <div className="card card-padded" style={{ marginBottom: 12 }}>
            <div className="row-between" style={{ marginBottom: 4 }}>
              <div className="section-title">
                <ShieldCheck size={14} style={{ color: "var(--data-violet)" }} />
                UTM Naming Governance
              </div>
              {governanceSaved && (
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--ok-fg)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Check size={13} /> Saved
                </span>
              )}
            </div>
            <p className="section-sub" style={{ marginBottom: 20 }}>
              Define approved UTM sources and mediums. When set, team members will see a
              warning when entering non-approved values.
            </p>

            {governanceLoading ? (
              <div style={{ padding: 40, display: "grid", placeItems: "center" }}>
                <Loader2 size={20} className="animate-spin" style={{ color: "var(--ink-500)" }} />
              </div>
            ) : (
              <div className="stack" style={{ gap: 20 }}>
                <div>
                  <div className="field-label" style={{ marginBottom: 10 }}>
                    Approved Sources
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        fontWeight: 400,
                        color: "var(--ink-500)",
                      }}
                    >
                      (e.g. google, facebook, email)
                    </span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {approvedSources.map((src) => (
                      <span
                        key={src}
                        className="pill pill-source"
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", fontSize: 12 }}
                      >
                        {src}
                        <button
                          onClick={() =>
                            setApprovedSources(approvedSources.filter((s) => s !== src))
                          }
                          style={{
                            background: "transparent",
                            border: 0,
                            color: "inherit",
                            opacity: 0.6,
                            cursor: "pointer",
                            display: "inline-flex",
                          }}
                        >
                          <XIcon size={11} />
                        </button>
                      </span>
                    ))}
                    {approvedSources.length === 0 && (
                      <span className="placeholder">
                        No restrictions — all sources allowed
                      </span>
                    )}
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <input
                      type="text"
                      value={newSource}
                      onChange={(e) => setNewSource(e.target.value.toLowerCase().trim())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newSource && !approvedSources.includes(newSource)) {
                          setApprovedSources([...approvedSources, newSource]);
                          setNewSource("");
                        }
                      }}
                      placeholder="Add source…"
                      className="input"
                      style={{ flex: 1, maxWidth: 280, height: 32 }}
                    />
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        if (newSource && !approvedSources.includes(newSource)) {
                          setApprovedSources([...approvedSources, newSource]);
                          setNewSource("");
                        }
                      }}
                      disabled={!newSource}
                    >
                      <Plus size={12} /> Add
                    </button>
                  </div>
                </div>

                <div>
                  <div className="field-label" style={{ marginBottom: 10 }}>
                    Approved Mediums
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        fontWeight: 400,
                        color: "var(--ink-500)",
                      }}
                    >
                      (e.g. cpc, email, social, organic)
                    </span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {approvedMediums.map((med) => (
                      <span
                        key={med}
                        className="pill pill-medium"
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", fontSize: 12 }}
                      >
                        {med}
                        <button
                          onClick={() =>
                            setApprovedMediums(approvedMediums.filter((m) => m !== med))
                          }
                          style={{
                            background: "transparent",
                            border: 0,
                            color: "inherit",
                            opacity: 0.6,
                            cursor: "pointer",
                            display: "inline-flex",
                          }}
                        >
                          <XIcon size={11} />
                        </button>
                      </span>
                    ))}
                    {approvedMediums.length === 0 && (
                      <span className="placeholder">
                        No restrictions — all mediums allowed
                      </span>
                    )}
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <input
                      type="text"
                      value={newMedium}
                      onChange={(e) => setNewMedium(e.target.value.toLowerCase().trim())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newMedium && !approvedMediums.includes(newMedium)) {
                          setApprovedMediums([...approvedMediums, newMedium]);
                          setNewMedium("");
                        }
                      }}
                      placeholder="Add medium…"
                      className="input"
                      style={{ flex: 1, maxWidth: 280, height: 32 }}
                    />
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        if (newMedium && !approvedMediums.includes(newMedium)) {
                          setApprovedMediums([...approvedMediums, newMedium]);
                          setNewMedium("");
                        }
                      }}
                      disabled={!newMedium}
                    >
                      <Plus size={12} /> Add
                    </button>
                  </div>
                </div>

                <div>
                  <button
                    className="btn btn-primary"
                    style={{ background: "var(--data-violet)" }}
                    onClick={saveGovernanceSettings}
                    disabled={governanceSaving}
                  >
                    {governanceSaving ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <ShieldCheck size={13} />
                    )}
                    {governanceSaving ? "Saving…" : "Save Rules"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Danger zone */}
        <div
          className="card card-padded"
          style={{ borderColor: "#FCA5B0", background: "#FEF7F8", marginTop: 12 }}
        >
          <div className="section-title" style={{ color: "var(--err-fg)" }}>
            <AlertTriangle size={14} /> {t("dangerZone")}
          </div>
          <div style={{ marginTop: 12 }}>
            <div
              className="row-between"
              style={{ padding: "12px 0", borderBottom: isWorkspaceOwner && currentWorkspace ? "1px solid #FCA5B0" : "none" }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-100)" }}>
                  {t("deleteAccount")}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink-400)", marginTop: 2 }}>
                  {t("deleteAccountDesc")}
                </div>
              </div>
              <button
                className="btn btn-danger"
                onClick={() => setShowDeleteAccountConfirm(true)}
              >
                {t("deleteAccount")}
              </button>
            </div>

            {showDeleteAccountConfirm && (
              <div
                style={{
                  margin: "12px 0",
                  padding: 14,
                  background: "var(--err-bg)",
                  border: "1px solid #F3C5CC",
                  borderRadius: 8,
                }}
              >
                <p style={{ fontSize: 13, color: "var(--err-fg)", margin: "0 0 12px" }}>
                  {t("deleteAccountConfirm")}
                </p>
                <div className="row" style={{ gap: 8 }}>
                  <button
                    className="btn btn-danger"
                    onClick={handleDeleteAccount}
                    disabled={isDeletingAccount}
                  >
                    {isDeletingAccount ? "…" : t("deleteAccount")}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowDeleteAccountConfirm(false)}
                    disabled={isDeletingAccount}
                  >
                    {tCommon("cancel")}
                  </button>
                </div>
              </div>
            )}

            {isWorkspaceOwner && currentWorkspace && (
              <div style={{ padding: "12px 0 0" }}>
                <div className="row-between">
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-100)" }}>
                      {tWorkspace("deleteWorkspace")}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-400)", marginTop: 2 }}>
                      {tWorkspace("deleteWorkspaceDesc")}
                    </div>
                  </div>
                  <button
                    className="btn btn-danger"
                    onClick={() => setShowDeleteWorkspaceConfirm(true)}
                  >
                    <Trash2 size={12} /> {tWorkspace("deleteWorkspace")}
                  </button>
                </div>

                {showDeleteWorkspaceConfirm && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 14,
                      background: "var(--err-bg)",
                      border: "1px solid #F3C5CC",
                      borderRadius: 8,
                    }}
                  >
                    {deleteWorkspaceError && (
                      <div
                        style={{
                          padding: 10,
                          background: "#F3C5CC",
                          borderRadius: 6,
                          color: "var(--err-fg)",
                          fontSize: 12,
                          marginBottom: 12,
                        }}
                      >
                        {deleteWorkspaceError}
                      </div>
                    )}
                    <div className="field">
                      <div className="field-label" style={{ color: "var(--err-fg)" }}>
                        {tWorkspace("deleteWorkspaceConfirm")}
                      </div>
                      <input
                        type="text"
                        value={deleteWorkspaceConfirmName}
                        onChange={(e) => setDeleteWorkspaceConfirmName(e.target.value)}
                        placeholder={currentWorkspace.name}
                        className="input"
                      />
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <button
                        className="btn btn-danger"
                        onClick={handleDeleteWorkspace}
                        disabled={
                          isDeletingWorkspace ||
                          deleteWorkspaceConfirmName !== currentWorkspace.name
                        }
                      >
                        {isDeletingWorkspace ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                        {tCommon("delete")}
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setShowDeleteWorkspaceConfirm(false);
                          setDeleteWorkspaceConfirmName("");
                          setDeleteWorkspaceError(null);
                        }}
                        disabled={isDeletingWorkspace}
                      >
                        {tCommon("cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
