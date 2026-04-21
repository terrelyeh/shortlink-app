"use client";

import { useEffect, useState, use } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Shield,
  User as UserIcon,
  Eye,
  Crown,
  Mail,
} from "lucide-react";

type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

interface InvitationData {
  email: string;
  role: Role;
  expiresAt: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    _count: { members: number };
  };
  invitedBy: {
    name: string | null;
    email: string;
    image: string | null;
  };
}

const roleIcon: Record<Role, typeof Crown> = {
  OWNER: Crown,
  ADMIN: Shield,
  MEMBER: UserIcon,
  VIEWER: Eye,
};

const roleLabel: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string; locale: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // Fetch invitation details on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/invitations/${token}`);
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setError(data.error || "Invitation not found");
        } else {
          setInvitation(data.invitation);
        }
      } catch {
        if (!cancelled) setError("Network error — please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAccept = async () => {
    if (sessionStatus !== "authenticated") {
      // Route back here after Google OAuth.
      signIn("google", { callbackUrl: window.location.pathname });
      return;
    }

    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invitations/${token}`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to accept invitation");
        return;
      }

      setAccepted(true);
      // Brief delay so user sees the success state, then jump to dashboard.
      setTimeout(() => router.push("/campaigns"), 1500);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setAccepting(false);
    }
  };

  // --- render states ---

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <CenterShell>
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">
            Invitation unavailable
          </h1>
          <p className="text-sm text-slate-500">{error}</p>
          <p className="text-xs text-slate-400 mt-4">
            Ask the person who invited you to generate a fresh link.
          </p>
        </div>
      </CenterShell>
    );
  }

  if (!invitation) return null;

  if (accepted) {
    return (
      <CenterShell>
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">
            Welcome to {invitation.workspace.name}
          </h1>
          <p className="text-sm text-slate-500">Taking you to the dashboard…</p>
        </div>
      </CenterShell>
    );
  }

  const RoleIcon = roleIcon[invitation.role];
  const loggedInEmail = session?.user?.email?.toLowerCase();
  const emailMatches =
    loggedInEmail && loggedInEmail === invitation.email.toLowerCase();

  return (
    <CenterShell>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-sky-50 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-sky-600" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            You're invited to join
          </p>
          <h1 className="text-xl font-semibold text-slate-900 leading-tight">
            {invitation.workspace.name}
          </h1>
        </div>
      </div>

      {invitation.workspace.description && (
        <p className="text-sm text-slate-600 leading-relaxed mb-5">
          {invitation.workspace.description}
        </p>
      )}

      <div className="space-y-3 mb-6">
        <Row
          icon={<Mail className="w-4 h-4 text-slate-400" />}
          label="Invited email"
          value={invitation.email}
        />
        <Row
          icon={<RoleIcon className="w-4 h-4 text-slate-400" />}
          label="Your role"
          value={roleLabel[invitation.role]}
        />
        <Row
          icon={<UserIcon className="w-4 h-4 text-slate-400" />}
          label="Invited by"
          value={
            invitation.invitedBy.name || invitation.invitedBy.email
          }
        />
        <Row
          icon={<Building2 className="w-4 h-4 text-slate-400" />}
          label="Workspace size"
          value={`${invitation.workspace._count.members} member${invitation.workspace._count.members === 1 ? "" : "s"}`}
        />
      </div>

      {sessionStatus === "authenticated" && !emailMatches && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-100 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 leading-relaxed">
            You're signed in as <strong>{loggedInEmail}</strong>, but this
            invitation is for <strong>{invitation.email}</strong>. Sign out
            and accept with the correct account.
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 leading-relaxed">{error}</p>
        </div>
      )}

      <button
        onClick={handleAccept}
        disabled={
          accepting ||
          (sessionStatus === "authenticated" && !emailMatches)
        }
        className="w-full py-2.5 bg-[#03A9F4] text-white text-sm font-semibold rounded-lg hover:bg-[#0288D1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {accepting && <Loader2 className="w-4 h-4 animate-spin" />}
        {sessionStatus === "authenticated"
          ? accepting
            ? "Joining…"
            : "Accept invitation"
          : "Sign in with Google to accept"}
      </button>

      <p className="text-[11px] text-slate-400 text-center mt-3">
        Expires {new Date(invitation.expiresAt).toLocaleString()}
      </p>
    </CenterShell>
  );
}

function CenterShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 max-w-md w-full p-6">
        {children}
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      {icon}
      <span className="text-slate-500 w-28 shrink-0">{label}</span>
      <span className="text-slate-900 font-medium truncate">{value}</span>
    </div>
  );
}
