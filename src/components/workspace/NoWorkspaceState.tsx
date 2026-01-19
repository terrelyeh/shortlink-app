"use client";

import { useRouter } from "next/navigation";
import { Building2, Mail, Plus } from "lucide-react";

export function NoWorkspaceState() {
  const router = useRouter();

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="w-20 h-20 bg-gradient-to-br from-violet-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Building2 className="w-10 h-10 text-violet-600" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-3">
          Welcome to Short Link Manager
        </h1>

        <p className="text-slate-500 mb-8">
          You don&apos;t have access to any workspace yet. Create your own workspace to get started, or wait for an invitation from a team administrator.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => router.push("/workspaces/new")}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl hover:from-violet-600 hover:to-purple-600 transition-all font-medium"
          >
            <Plus className="w-5 h-5" />
            Create Your Workspace
          </button>

          <div className="flex items-center gap-4 text-slate-400">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-sm">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <div className="flex items-center justify-center gap-2 text-slate-500">
            <Mail className="w-5 h-5" />
            <span className="text-sm">Check your email for workspace invitations</span>
          </div>
        </div>

        <p className="mt-8 text-xs text-slate-400">
          Need help? Contact your organization administrator for access.
        </p>
      </div>
    </div>
  );
}
