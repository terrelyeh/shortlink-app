"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { formatRelativeTime } from "@/lib/utils/format";

/**
 * SyncButton — page-level "refresh cache" control.
 *
 * Invalidates the provided query keys on click. The "Last synced" label
 * reads the freshest `dataUpdatedAt` across those keys so it honestly
 * reflects when the on-screen data was last pulled from the server.
 */
export function SyncButton({ queryKeys }: { queryKeys: readonly unknown[][] }) {
  const t = useTranslations("common");
  const qc = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  // Tick every 30s so the "X min ago" label stays current.
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
          {t("lastSynced", { time: formatRelativeTime(lastSyncedAt, t) })}
        </span>
      )}
      <button
        type="button"
        className="btn btn-secondary"
        onClick={handleSync}
        disabled={isSyncing}
        title={t("syncTooltip")}
      >
        <RefreshCw
          size={13}
          style={{
            animation: isSyncing ? "spin 0.8s linear infinite" : undefined,
          }}
        />
        {t("sync")}
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
