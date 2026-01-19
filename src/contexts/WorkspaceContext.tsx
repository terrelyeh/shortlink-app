"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  memberCount: number;
  linkCount: number;
  campaignCount: number;
  createdAt: string;
  updatedAt: string;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  isLoading: boolean;
  error: string | null;
  setCurrentWorkspace: (workspace: Workspace) => void;
  refreshWorkspaces: () => Promise<void>;
  hasPermission: (action: "view" | "create" | "edit" | "delete" | "manage") => boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined
);

const WORKSPACE_STORAGE_KEY = "shortlink-current-workspace";

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch workspaces
  const fetchWorkspaces = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/workspaces");
      if (!response.ok) {
        throw new Error("Failed to fetch workspaces");
      }

      const data = await response.json();
      setWorkspaces(data.workspaces || []);

      // Set current workspace from localStorage or default to first
      const storedWorkspaceId =
        typeof window !== "undefined"
          ? localStorage.getItem(WORKSPACE_STORAGE_KEY)
          : null;

      if (data.workspaces?.length > 0) {
        const stored = data.workspaces.find(
          (w: Workspace) => w.id === storedWorkspaceId
        );
        setCurrentWorkspaceState(stored || data.workspaces[0]);
      } else {
        setCurrentWorkspaceState(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch workspaces");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Set current workspace and persist to localStorage
  const setCurrentWorkspace = useCallback((workspace: Workspace) => {
    setCurrentWorkspaceState(workspace);
    if (typeof window !== "undefined") {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, workspace.id);
    }
  }, []);

  // Check if user has permission for an action in current workspace
  const hasPermission = useCallback(
    (action: "view" | "create" | "edit" | "delete" | "manage") => {
      if (!currentWorkspace) return false;

      const role = currentWorkspace.role;

      switch (action) {
        case "view":
          // Everyone can view
          return true;
        case "create":
          // OWNER, ADMIN, MEMBER can create
          return ["OWNER", "ADMIN", "MEMBER"].includes(role);
        case "edit":
          // OWNER, ADMIN, MEMBER can edit (own resources)
          return ["OWNER", "ADMIN", "MEMBER"].includes(role);
        case "delete":
          // OWNER, ADMIN can delete
          return ["OWNER", "ADMIN"].includes(role);
        case "manage":
          // Only OWNER and ADMIN can manage workspace settings/members
          return ["OWNER", "ADMIN"].includes(role);
        default:
          return false;
      }
    },
    [currentWorkspace]
  );

  const value: WorkspaceContextType = {
    workspaces,
    currentWorkspace,
    isLoading,
    error,
    setCurrentWorkspace,
    refreshWorkspaces: fetchWorkspaces,
    hasPermission,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
