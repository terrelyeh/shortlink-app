"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace, Workspace } from "@/contexts/WorkspaceContext";
import {
  Building2,
  ChevronDown,
  Check,
  Plus,
  Settings,
  Users,
  Loader2,
} from "lucide-react";

interface WorkspaceSwitcherProps {
  collapsed?: boolean;
}

export function WorkspaceSwitcher({ collapsed = false }: WorkspaceSwitcherProps) {
  const router = useRouter();
  const {
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
    isLoading,
    hasPermission,
  } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="px-3 py-2">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-100 animate-pulse">
          <div className="w-8 h-8 bg-slate-200 rounded-lg" />
          {!collapsed && <div className="h-4 w-24 bg-slate-200 rounded" />}
        </div>
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="px-3 py-2">
        <button
          onClick={() => router.push("/workspaces/new")}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:from-violet-600 hover:to-purple-600 transition-all"
        >
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <Plus className="w-5 h-5" />
          </div>
          {!collapsed && (
            <span className="font-medium text-sm">Create Workspace</span>
          )}
        </button>
      </div>
    );
  }

  const handleWorkspaceChange = (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    setIsOpen(false);
    // Refresh the current page to reload data for the new workspace
    router.refresh();
  };

  return (
    <div className="px-3 py-2 relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-all ${
          isOpen ? "ring-2 ring-violet-500 bg-slate-200" : ""
        }`}
      >
        <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
          <Building2 className="w-4 h-4" />
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">
                {currentWorkspace?.name || "Select Workspace"}
              </div>
              <div className="text-xs text-slate-500 capitalize">
                {currentWorkspace?.role.toLowerCase()}
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute left-3 right-3 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 z-50 py-2 max-h-[400px] overflow-y-auto">
            {/* Workspaces List */}
            <div className="px-2 pb-2">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider px-2 py-1">
                Workspaces
              </div>
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => handleWorkspaceChange(workspace)}
                  className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors ${
                    currentWorkspace?.id === workspace.id ? "bg-violet-50" : ""
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      currentWorkspace?.id === workspace.id
                        ? "bg-violet-500 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {workspace.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {workspace.linkCount} links · {workspace.memberCount} members
                    </div>
                  </div>
                  {currentWorkspace?.id === workspace.id && (
                    <Check className="w-4 h-4 text-violet-500" />
                  )}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100 my-1" />

            {/* Actions */}
            <div className="px-2">
              {hasPermission("manage") && currentWorkspace && (
                <>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      router.push(`/workspaces/${currentWorkspace.id}/members`);
                    }}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-600"
                  >
                    <Users className="w-4 h-4" />
                    <span className="text-sm">Manage Members</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      router.push(`/workspaces/${currentWorkspace.id}/settings`);
                    }}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-600"
                  >
                    <Settings className="w-4 h-4" />
                    <span className="text-sm">Workspace Settings</span>
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push("/workspaces/new");
                }}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors text-violet-600"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Create Workspace</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
