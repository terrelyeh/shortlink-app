"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace, Workspace } from "@/contexts/WorkspaceContext";
import { ChevronDown, Check, Plus, Building2 } from "lucide-react";

interface WorkspaceSwitcherProps {
  collapsed?: boolean;
}

export function WorkspaceSwitcher({ collapsed = false }: WorkspaceSwitcherProps) {
  const router = useRouter();
  const { workspaces, currentWorkspace, setCurrentWorkspace, isLoading } =
    useWorkspace();
  const [isOpen, setIsOpen] = useState(false);

  const initials = (currentWorkspace?.name || "W")
    .split(/[\s_-]+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (isLoading) {
    return (
      <div className="workspace-picker" style={{ opacity: 0.6 }}>
        <div className="ws-avatar" style={{ background: "rgba(255,255,255,0.08)" }} />
        {!collapsed && (
          <div className="ws-meta">
            <div className="ws-name" style={{ height: 10, width: 80, background: "rgba(255,255,255,0.08)", borderRadius: 3 }} />
          </div>
        )}
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <button
        onClick={() => router.push("/workspaces/new")}
        className="workspace-picker"
        style={{ background: "var(--brand-600)", borderColor: "transparent" }}
      >
        <div className="ws-avatar" style={{ background: "rgba(255,255,255,0.15)" }}>
          <Plus size={14} />
        </div>
        {!collapsed && (
          <div className="ws-meta">
            <div className="ws-name">Create Workspace</div>
          </div>
        )}
      </button>
    );
  }

  const handleWorkspaceChange = (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    setIsOpen(false);
    router.refresh();
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="workspace-picker"
      >
        <div className="ws-avatar">{initials}</div>
        {!collapsed && (
          <>
            <div className="ws-meta">
              <div
                className="ws-name"
                style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {currentWorkspace?.name || "Select"}
              </div>
              <div className="ws-role" style={{ textTransform: "capitalize" }}>
                {currentWorkspace?.role.toLowerCase()}
              </div>
            </div>
            <ChevronDown
              size={14}
              style={{
                color: "#64748B",
                transition: "transform .15s",
                transform: isOpen ? "rotate(180deg)" : "none",
              }}
            />
          </>
        )}
      </button>

      {isOpen && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
            onClick={() => setIsOpen(false)}
          />

          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "100%",
              marginTop: 4,
              background: "#fff",
              borderRadius: "var(--r-md)",
              boxShadow: "var(--shadow-pop)",
              border: "1px solid var(--border)",
              zIndex: 50,
              padding: 8,
              maxHeight: 400,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "var(--ink-500)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                padding: "6px 10px",
              }}
            >
              Workspaces
            </div>
            {workspaces.map((workspace) => {
              const isCurrent = currentWorkspace?.id === workspace.id;
              return (
                <button
                  key={workspace.id}
                  onClick={() => handleWorkspaceChange(workspace)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 6,
                    background: isCurrent ? "var(--brand-50)" : "transparent",
                    border: 0,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrent) e.currentTarget.style.background = "var(--bg-subtle)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrent) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: isCurrent ? "var(--brand-500)" : "var(--bg-subtle)",
                      color: isCurrent ? "#fff" : "var(--ink-400)",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Building2 size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-100)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {workspace.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-500)" }}>
                      {workspace.linkCount} links · {workspace.memberCount} members
                    </div>
                  </div>
                  {isCurrent && <Check size={14} style={{ color: "var(--brand-600)" }} />}
                </button>
              );
            })}
            <div style={{ borderTop: "1px solid var(--border)", margin: "6px 0" }} />
            <button
              onClick={() => {
                setIsOpen(false);
                router.push("/workspaces/new");
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 6,
                background: "transparent",
                border: 0,
                cursor: "pointer",
                color: "var(--brand-600)",
                fontWeight: 500,
                fontSize: 12.5,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Plus size={14} />
              Create Workspace
            </button>
          </div>
        </>
      )}
    </div>
  );
}
