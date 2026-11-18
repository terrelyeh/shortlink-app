"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { PageHeader } from "@/components/layout/PageHeader";
import { SyncButton } from "@/components/layout/SyncButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { formatRelativeTime } from "@/lib/utils/format";

interface TrashedLink {
  id: string;
  code: string;
  title: string | null;
  originalUrl: string;
  ogTitle: string | null;
  ogImage: string | null;
  utmCampaign: string | null;
  clickCount: number;
  createdAt: string;
  deletedAt: string;
  canRestore: boolean;
}

// LinksClient invalidates this same key after a delete.
const trashKey = ["links-trash"] as const;

export default function TrashClient() {
  const t = useTranslations("links");
  const tCommon = useTranslations("common");
  const { success, error: toastError } = useToast();
  const qc = useQueryClient();
  const router = useRouter();
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<TrashedLink[]>({
    queryKey: trashKey,
    queryFn: async () => {
      const res = await fetch("/api/links/trash");
      if (!res.ok) throw new Error("Failed to load trash");
      return ((await res.json()).links ?? []) as TrashedLink[];
    },
  });
  const links = data ?? [];

  const shortBaseUrl = process.env.NEXT_PUBLIC_SHORT_URL || "http://localhost:3000/s";

  const restore = async (link: TrashedLink) => {
    setRestoringId(link.id);
    try {
      const res = await fetch(`/api/links/${link.id}/restore`, { method: "POST" });
      if (!res.ok) throw new Error();
      qc.setQueryData<TrashedLink[]>(trashKey, (old) => old?.filter((l) => l.id !== link.id));
      // A restored link reappears everywhere a live link shows up.
      qc.invalidateQueries({ queryKey: ["links"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["campaigns-summary"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["analytics-raw"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["campaign-links"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["utm-campaigns"] });
      success(t("trashRestored", { code: link.code }));
    } catch {
      toastError(t("trashRestoreFailed"));
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <>
      <PageHeader
        back={t("trashBack")}
        onBack={() => router.push("/links")}
        title={t("trashTitle")}
        description={t("trashDescription")}
        actions={<SyncButton queryKeys={[[...trashKey]]} />}
      />

      {isLoading && !data ? (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--ink-500)" }} />
        </div>
      ) : links.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Trash2 className="w-10 h-10" />}
            title={t("trashEmpty")}
            description={t("trashEmptyDesc")}
          />
        </div>
      ) : (
        <div className="tbl-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t("title")}</th>
                <th style={{ width: 200 }}>{t("shortUrl")}</th>
                <th style={{ width: 90, textAlign: "right" }}>{t("clicks")}</th>
                <th style={{ width: 120 }}>{t("trashDeletedAt")}</th>
                <th style={{ width: 110 }} />
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id}>
                  <td>
                    <div style={{ fontWeight: 500, color: "var(--ink-100)" }}>
                      {link.title || link.ogTitle || link.code}
                    </div>
                    <div
                      className="muted"
                      style={{
                        fontSize: 11.5,
                        maxWidth: 420,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={link.originalUrl}
                    >
                      {link.originalUrl}
                    </div>
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                    {shortBaseUrl.replace(/^https?:\/\//, "")}/{link.code}
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {link.clickCount.toLocaleString()}
                  </td>
                  <td title={new Date(link.deletedAt).toLocaleString()}>
                    {formatRelativeTime(new Date(link.deletedAt), tCommon)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {link.canRestore ? (
                      <button
                        className="btn btn-secondary"
                        style={{ height: 28, fontSize: 11.5 }}
                        disabled={restoringId === link.id}
                        onClick={() => restore(link)}
                      >
                        {restoringId === link.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <RotateCcw size={12} />
                        )}{" "}
                        {t("trashRestore")}
                      </button>
                    ) : (
                      <span className="muted" style={{ fontSize: 11.5 }} title={t("trashNoPermission")}>
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
