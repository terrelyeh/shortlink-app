"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  Users,
  Loader2,
  UserPlus,
  Mail,
  Crown,
  Shield,
  User,
  Eye,
  MoreVertical,
  Trash2,
  ChevronDown,
  Copy,
  Check,
  X,
  Clock,
} from "lucide-react";

type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

interface Member {
  id: string;
  role: WorkspaceRole;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

interface Invitation {
  id: string;
  email: string;
  role: WorkspaceRole;
  createdAt: string;
  expiresAt: string;
  invitedBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

const roleIcons: Record<WorkspaceRole, typeof Crown> = {
  OWNER: Crown,
  ADMIN: Shield,
  MEMBER: User,
  VIEWER: Eye,
};

const roleColors: Record<WorkspaceRole, string> = {
  OWNER: "text-amber-600 bg-amber-50",
  ADMIN: "text-purple-600 bg-purple-50",
  MEMBER: "text-blue-600 bg-blue-50",
  VIEWER: "text-slate-600 bg-slate-50",
};

export function MembersTab() {
  const { currentWorkspace, hasPermission } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const t = useTranslations("workspace");
  const tCommon = useTranslations("common");

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite form state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("MEMBER");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [copiedInviteLink, setCopiedInviteLink] = useState<string | null>(null);

  // Member action state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const canManage = hasPermission("manage");
  const isOwner = currentWorkspace?.role === "OWNER";

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setIsLoading(true);
      setError(null);

      const [membersRes, invitationsRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/members`),
        fetch(`/api/workspaces/${workspaceId}/invitations`),
      ]);

      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData.members);
      }

      if (invitationsRes.ok) {
        const invitationsData = await invitationsRes.json();
        setInvitations(invitationsData.invitations);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);

    if (!inviteEmail.trim()) {
      setInviteError("Email is required");
      return;
    }

    setIsInviting(true);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send invitation");
      }

      setInviteSuccess(t("invitationSent", { email: inviteEmail }));
      setInviteEmail("");
      setInviteRole("MEMBER");

      const invitationsRes = await fetch(`/api/workspaces/${workspaceId}/invitations`);
      if (invitationsRes.ok) {
        const invitationsData = await invitationsRes.json();
        setInvitations(invitationsData.invitations);
      }

      setTimeout(() => {
        setInviteSuccess(null);
        setShowInviteForm(false);
      }, 2000);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setIsInviting(false);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: WorkspaceRole) => {
    setChangingRoleId(memberId);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role: newRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to change role");
      }

      setMembers(members.map(m =>
        m.id === memberId ? { ...m, role: newRole } : m
      ));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to change role");
    } finally {
      setChangingRoleId(null);
      setOpenMenuId(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm(t("removeMemberConfirm"))) return;

    setRemovingId(memberId);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/members?memberId=${memberId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove member");
      }

      setMembers(members.filter(m => m.id !== memberId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setRemovingId(null);
      setOpenMenuId(null);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/invitations?invitationId=${invitationId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to cancel invitation");
      }

      setInvitations(invitations.filter(inv => inv.id !== invitationId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel invitation");
    }
  };

  const copyInviteLink = (invitationId: string) => {
    const inviteUrl = `${window.location.origin}/invite/${invitationId}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedInviteLink(invitationId);
    setTimeout(() => setCopiedInviteLink(null), 2000);
  };

  if (!currentWorkspace) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
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
      {/* Header with invite button */}
      {canManage && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="flex items-center gap-2 px-4 py-2 bg-[#03A9F4] text-white rounded-lg hover:bg-[#0288D1] transition-colors text-sm font-medium"
          >
            <UserPlus className="w-4 h-4" />
            {t("inviteMember")}
          </button>
        </div>
      )}

      {/* Invite Form */}
      {showInviteForm && canManage && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4">{t("inviteMember")}</h3>

          <form onSubmit={handleInvite} className="space-y-4">
            {inviteError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
                {inviteError}
              </div>
            )}
            {inviteSuccess && (
              <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-green-700 text-sm flex items-center gap-2">
                <Check className="w-4 h-4" />
                {inviteSuccess}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("inviteEmail")}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={t("inviteEmailPlaceholder")}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("inviteRole")}
              </label>
              <div className="relative">
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] transition-all appearance-none bg-white"
                >
                  {isOwner && <option value="ADMIN">{t("roles.ADMIN")}</option>}
                  <option value="MEMBER">{t("roles.MEMBER")}</option>
                  <option value="VIEWER">{t("roles.VIEWER")}</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {t(`roleDescriptions.${inviteRole}`)}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowInviteForm(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm"
              >
                {tCommon("cancel")}
              </button>
              <button
                type="submit"
                disabled={isInviting}
                className="flex items-center gap-2 px-4 py-2 bg-[#03A9F4] text-white rounded-lg hover:bg-[#0288D1] transition-colors disabled:opacity-50 text-sm"
              >
                {isInviting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                {t("sendInvitation")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pending Invitations */}
      {invitations.length > 0 && canManage && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" />
            {t("pendingInvitations")}
          </h3>

          <div className="space-y-3">
            {invitations.map((invitation) => {
              const RoleIcon = roleIcons[invitation.role];
              return (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                      <Mail className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{invitation.email}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${roleColors[invitation.role]}`}>
                          <RoleIcon className="w-3 h-3" />
                          {t(`roles.${invitation.role}`)}
                        </span>
                        <span>
                          Invited by {invitation.invitedBy.name || invitation.invitedBy.email}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyInviteLink(invitation.id)}
                      className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                      title={t("copyInviteLink")}
                    >
                      {copiedInviteLink === invitation.id ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleCancelInvitation(invitation.id)}
                      className="p-2 text-red-400 hover:text-red-600 transition-colors"
                      title={t("cancelInvitation")}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Members List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">
            {members.length} {t("members")}
          </h3>
        </div>

        <div className="divide-y divide-slate-100">
          {members.map((member) => {
            const RoleIcon = roleIcons[member.role];
            const canModify = canManage &&
              member.role !== "OWNER" &&
              (isOwner || member.role !== "ADMIN");

            return (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {member.user.image ? (
                    <img
                      src={member.user.image}
                      alt={member.user.name || ""}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                      <span className="text-lg font-medium text-slate-600">
                        {(member.user.name || member.user.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-slate-900">
                      {member.user.name || member.user.email}
                    </p>
                    <p className="text-sm text-slate-500">{member.user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${roleColors[member.role]}`}>
                    <RoleIcon className="w-4 h-4" />
                    {t(`roles.${member.role}`)}
                  </span>

                  {canModify && (
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === member.id ? null : member.id)}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openMenuId === member.id && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                            <div className="px-3 py-2 text-xs font-medium text-slate-400 uppercase">
                              {t("changeRole")}
                            </div>
                            {isOwner && member.role !== "ADMIN" && (
                              <button
                                onClick={() => handleChangeRole(member.id, "ADMIN")}
                                disabled={changingRoleId === member.id}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <Shield className="w-4 h-4 text-purple-500" />
                                {t("roles.ADMIN")}
                              </button>
                            )}
                            {member.role !== "MEMBER" && (
                              <button
                                onClick={() => handleChangeRole(member.id, "MEMBER")}
                                disabled={changingRoleId === member.id}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <User className="w-4 h-4 text-blue-500" />
                                {t("roles.MEMBER")}
                              </button>
                            )}
                            {member.role !== "VIEWER" && (
                              <button
                                onClick={() => handleChangeRole(member.id, "VIEWER")}
                                disabled={changingRoleId === member.id}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <Eye className="w-4 h-4 text-slate-500" />
                                {t("roles.VIEWER")}
                              </button>
                            )}

                            <div className="border-t border-slate-100 my-1" />

                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              disabled={removingId === member.id}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              {removingId === member.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                              {t("removeMember")}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
