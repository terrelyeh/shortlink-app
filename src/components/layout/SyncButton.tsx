"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatRelativeTime } from "@/lib/utils/format";

/**
 * SyncButton — page-level "refresh cache" control.
 *
 * Invalidates the provided query keys on click, which causes their next
 * render to refetch. The "Last synced" timestamp is derived from the
 * freshest `dataUpdatedAt` across those keys, so it honestly reflects
 * when the data the user is looking at was last pulled from the server.
 *
 * Pass one key per query this page depends on — e.g. on /campaigns we
 * pass `[["campaigns-summary", window]]`, on Campaign Detail we pass
 * three keys (links, goal, raw analytics).
 */
export function SyncButton({ queryKeys }: { queryKeys: readonly unknown[][] }) {
  const qc = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  // Tick every 30s so the "X min ago" label stays roughly current without
  // being chatty. Resolution past a minute is good enough for UX copy.
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const lastSyncedAt = useMemo(() => {
    let newest = 0;
    for (const key of queryKeys) {
      const state = qc.getQueryState(key);
      if (state?.dataUpdatedAt && state.dataUpdatedAt > newest) {
        newest = state.dataUpdatedAt;
      }
    }
    return newest > 0 ? new Date(newest) : null;
  }, [qc, queryKeys]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await Promise.all(
        queryKeys.map((key) => qc.invalidateQueries({ queryKey: key })),
      );
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {lastSyncedAt && (
        <span
          style={{ fontSize: 11.5, color: "var(--ink-500)" }}
          title={lastSyncedAt.toLocaleString()}
        >
          Last synced {formatRelativeTime(lastSyncedAt)}
        </span>
      )}
      <button
        type="button"
        className="btn btn-secondary"
        onClick={handleSync}
        disabled={isSyncing}
        title="Pull fresh data from the server"
      >
        <RefreshCw
          size={13}
          style={{
            animation: isSyncing ? "spin 0.8s linear infinite" : undefined,
          }}
        />
        Sync
      </button>
      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
