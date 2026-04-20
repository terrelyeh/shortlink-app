/**
 * Client-side fetch patch that auto-injects the current workspace id as
 * an `x-workspace-id` header on same-origin API calls. Without this,
 * every `/api/*` request lands in `resolveWorkspaceScope()`'s
 * createdById fallback and writes orphan (workspaceId=null) rows.
 *
 * Reads the current workspace id from the same localStorage key that
 * WorkspaceContext writes to — so switching workspaces in the UI
 * immediately affects subsequent requests, no remount needed.
 *
 * Leaves `/api/auth/*` (NextAuth internal) alone.
 */

const STORAGE_KEY = "shortlink-current-workspace";
const PATCHED_FLAG = "__workspaceFetchPatched__";

export function installWorkspaceFetch() {
  if (typeof window === "undefined") return;
  const w = window as Window & { [PATCHED_FLAG]?: boolean };
  if (w[PATCHED_FLAG]) return;
  w[PATCHED_FLAG] = true;

  const original = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    // Only same-origin /api/* — skip NextAuth endpoints so we don't
    // pollute session handshake with stale workspace ids.
    const isOurApi =
      (url.startsWith("/api/") || url.includes(`${window.location.origin}/api/`)) &&
      !url.includes("/api/auth/");

    if (isOurApi) {
      const wsId = readCurrentWorkspaceId();
      if (wsId) {
        const headers = new Headers(init?.headers ?? {});
        if (!headers.has("x-workspace-id")) {
          headers.set("x-workspace-id", wsId);
        }
        init = { ...(init ?? {}), headers };
      }
    }

    return original(input, init);
  };
}

function readCurrentWorkspaceId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
