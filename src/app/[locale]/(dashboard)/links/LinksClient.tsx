"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/routing";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LinkTableRow } from "@/components/links/LinkTableRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import {
  Plus,
  Search,
  Loader2,
  Link2,
  Layers,
  Tag as TagIcon,
  Trash2,
  Pause,
  Play,
  Archive,
  Download,
  ArrowUpDown,
  ChevronDown,
  FileSpreadsheet,
} from "lucide-react";
import { CampaignFilter } from "@/components/campaigns/CampaignFilter";
import { PageHeader } from "@/components/layout/PageHeader";
import { SyncButton } from "@/components/layout/SyncButton";

interface LinkTag {
  tag: { id: string; name: string; color?: string | null };
}

interface TagOption {
  id: string;
  name: string;
  color?: string | null;
  _count: { links: number };
}

interface ShortLink {
  id: string;
  code: string;
  originalUrl: string;
  title: string | null;
  status: string;
  createdAt: string;
  startsAt?: string | null;
  allowedCountries?: string[];
  utmCampaign?: string | null;
  clicksLast7d?: number;
  trendPct?: number | null;
  ogImage?: string | null;
  ogTitle?: string | null;
  _count: { clicks: number; conversions?: number };
  tags?: LinkTag[];
}

interface LinksClientProps {
  initialCampaign?: string;
}

const LINK_CAP = 500;

interface LinksPayload {
  links: ShortLink[];
  pagination: { total: number };
}

export default function LinksClient({ initialCampaign = "" }: LinksClientProps) {
  const t = useTranslations("links");
  const tCommon = useTranslations("common");
  const { success, error: toastError } = useToast();
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const linksKey = useMemo(() => ["links", LINK_CAP] as const, []);
  const tagsKey = useMemo(() => ["tags"] as const, []);

  const { data: linksData, isLoading: linksLoading, isFetching: refreshing } =
    useQuery<LinksPayload>({
      queryKey: linksKey,
      queryFn: async () => {
        const response = await fetch(`/api/links?limit=${LINK_CAP}`);
        if (!response.ok) throw new Error("Failed to load links");
        return (await response.json()) as LinksPayload;
      },
    });
  const allLinks = useMemo(() => linksData?.links ?? [], [linksData]);
  const totalLinks = linksData?.pagination.total ?? 0;
  const loadedCap = LINK_CAP;

  const { data: tagsData } = useQuery<TagOption[]>({
    queryKey: tagsKey,
    queryFn: async () => {
      const response = await fetch("/api/tags");
      if (!response.ok) throw new Error("Failed to load tags");
      return ((await response.json()).tags || []) as TagOption[];
    },
  });
  const allTags = useMemo(() => tagsData ?? [], [tagsData]);

  // Optimistic mutation helpers against the React Query cache. Avoids a
  // second source of truth in local state — every mutation below edits
  // the cached `LinksPayload` directly.
  const patchLink = useCallback(
    (id: string, patch: Partial<ShortLink>) => {
      qc.setQueryData<LinksPayload>(linksKey, (old) =>
        old
          ? {
              ...old,
              links: old.links.map((l) => (l.id === id ? { ...l, ...patch } : l)),
            }
          : old,
      );
    },
    [qc, linksKey],
  );
  const removeLink = useCallback(
    (id: string) => {
      qc.setQueryData<LinksPayload>(linksKey, (old) =>
        old
          ? {
              ...old,
              links: old.links.filter((l) => l.id !== id),
              pagination: { ...old.pagination, total: Math.max(0, old.pagination.total - 1) },
            }
          : old,
      );
    },
    [qc, linksKey],
  );

  // After mutations, other pages' caches may be stale.
  const invalidateDerived = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["campaigns-summary"] });
    qc.invalidateQueries({ queryKey: ["analytics-raw"] });
    qc.invalidateQueries({ queryKey: ["campaign-links"] });
    qc.invalidateQueries({ queryKey: ["utm-campaigns"] });
  }, [qc]);

  // Pulls fresh data for this page AND busts derived caches.
  const refreshLinks = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: linksKey });
    await qc.invalidateQueries({ queryKey: tagsKey });
    invalidateDerived();
  }, [qc, linksKey, tagsKey, invalidateDerived]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [campaignFilter, setCampaignFilter] = useState(
    searchParams.get("campaign") || initialCampaign,
  );

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);

  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [batchTagLoading, setBatchTagLoading] = useState(false);

  const shortBaseUrl = process.env.NEXT_PUBLIC_SHORT_URL || "http://localhost:3000/s";

  const links = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = allLinks;
    if (q) {
      out = out.filter(
        (l) =>
          l.code.toLowerCase().includes(q) ||
          l.originalUrl.toLowerCase().includes(q) ||
          (l.title?.toLowerCase() ?? "").includes(q),
      );
    }
    if (statusFilter) out = out.filter((l) => l.status === statusFilter);
    if (campaignFilter) {
      if (campaignFilter === "__none__") out = out.filter((l) => !l.utmCampaign);
      else out = out.filter((l) => l.utmCampaign === campaignFilter);
    }
    if (tagFilter) {
      out = out.filter((l) => (l.tags || []).some((tg) => tg.tag.id === tagFilter));
    }
    const dir = sortOrder === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      if (sortBy === "clicks") return (a._count.clicks - b._count.clicks) * dir;
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
    });
    return out;
  }, [allLinks, search, statusFilter, campaignFilter, tagFilter, sortBy, sortOrder]);

  const confirmDelete = (id: string) => setDeleteConfirmId(id);

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    try {
      const response = await fetch(`/api/links/${id}`, { method: "DELETE" });
      if (response.ok) {
        removeLink(id);
        invalidateDerived();
        success("Link deleted.");
      } else toastError("Failed to delete link.");
    } catch {
      toastError("Failed to delete link.");
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const response = await fetch(`/api/links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        patchLink(id, { status });
        invalidateDerived();
        success(
          status === "ACTIVE"
            ? "Link activated."
            : status === "PAUSED"
              ? "Link paused."
              : "Link archived.",
        );
      } else toastError("Failed to update status.");
    } catch {
      toastError("Failed to update status.");
    }
  };

  const handleClone = async (id: string) => {
    try {
      const response = await fetch(`/api/links/${id}/clone`, { method: "POST" });
      if (response.ok) {
        refreshLinks();
        success("Link cloned successfully.");
      } else toastError("Failed to clone link.");
    } catch {
      toastError("Failed to clone link.");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === links.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(links.map((l) => l.id)));
  };

  const handleBatchTag = async (tagId: string) => {
    if (selectedIds.size === 0 || !tagId) return;
    setShowTagDropdown(false);
    setBatchTagLoading(true);
    try {
      const response = await fetch("/api/links/batch-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: "add_tag", tagId }),
      });
      if (response.ok) {
        refreshLinks();
        success(`Tag added to ${selectedIds.size} link${selectedIds.size > 1 ? "s" : ""}.`);
      } else toastError("Failed to add tag.");
    } catch {
      toastError("Failed to add tag.");
    } finally {
      setBatchTagLoading(false);
    }
  };

  const executeBatchDelete = async () => {
    setBatchDeleteConfirm(false);
    setBatchLoading(true);
    try {
      const response = await fetch("/api/links/batch-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: "delete" }),
      });
      if (response.ok) {
        const count = selectedIds.size;
        setSelectedIds(new Set());
        refreshLinks();
        success(`${count} link${count > 1 ? "s" : ""} deleted.`);
      } else toastError("Batch delete failed.");
    } catch {
      toastError("Batch delete failed.");
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchAction = async (action: "pause" | "activate" | "archive") => {
    if (selectedIds.size === 0) return;
    setBatchLoading(true);
    try {
      const response = await fetch("/api/links/batch-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action }),
      });
      if (response.ok) {
        const count = selectedIds.size;
        setSelectedIds(new Set());
        refreshLinks();
        const label = action === "activate" ? "activated" : action === "pause" ? "paused" : "archived";
        success(`${count} link${count > 1 ? "s" : ""} ${label}.`);
      } else toastError("Batch action failed.");
    } catch {
      toastError("Batch action failed.");
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <>
      <ConfirmDialog
        open={!!deleteConfirmId}
        title="Delete this link?"
        description="This action cannot be undone. All click data for this link will be permanently lost."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={executeDelete}
        onCancel={() => setDeleteConfirmId(null)}
        variant="danger"
      />
      <ConfirmDialog
        open={batchDeleteConfirm}
        title={`Delete ${selectedIds.size} link${selectedIds.size > 1 ? "s" : ""}?`}
        description="This action cannot be undone. All click data for these links will be permanently lost."
        confirmLabel="Delete All"
        cancelLabel="Cancel"
        onConfirm={executeBatchDelete}
        onCancel={() => setBatchDeleteConfirm(false)}
        variant="danger"
      />

      <PageHeader
        title="Link Management"
        description={
          <>
            {links.length} of {totalLinks} {totalLinks === 1 ? "link" : "links"}
            {totalLinks > loadedCap && (
              <span style={{ color: "var(--data-amber)", marginLeft: 4 }}>
                (showing first {loadedCap})
              </span>
            )}
            {campaignFilter && campaignFilter !== "__none__" && (
              <span className="muted">
                {" "}
                in{" "}
                <span style={{ fontFamily: "var(--font-mono)" }}>{campaignFilter}</span>
              </span>
            )}
            {campaignFilter === "__none__" && (
              <span className="muted"> without campaign</span>
            )}
          </>
        }
        actions={
          <>
            <SyncButton queryKeys={[[...linksKey], [...tagsKey]]} />
            <a
              href={`/api/export/links${statusFilter ? `?status=${statusFilter}` : ""}`}
              className="btn btn-secondary"
            >
              <Download size={12} /> {tCommon("export")}
            </a>
            <Link href="/links/new" className="btn btn-secondary">
              <Plus size={12} /> {t("createNew")}
            </Link>
            <Link href="/links/import" className="btn btn-secondary">
              <FileSpreadsheet size={12} /> Import CSV
            </Link>
            <Link href="/links/batch" className="btn btn-primary">
              <Layers size={12} /> Batch create
            </Link>
          </>
        }
      />

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search" style={{ minWidth: 240, flex: 1 }}>
          <Search size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tCommon("search")}
          />
        </div>
        <CampaignFilter value={campaignFilter} onChange={setCampaignFilter} showNoCampaign />
        <div className="chip-row">
          {["", "ACTIVE", "PAUSED", "ARCHIVED"].map((status) => (
            <button
              key={status || "all"}
              className={`chip ${statusFilter === status ? "active" : ""}`}
              onClick={() => setStatusFilter(status)}
            >
              {status === ""
                ? tCommon("all")
                : status === "ACTIVE"
                  ? t("active")
                  : status === "PAUSED"
                    ? t("paused")
                    : t("archived")}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ position: "relative" }}>
          <select
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [by, order] = e.target.value.split(":");
              setSortBy(by);
              setSortOrder(order);
            }}
            className="input"
            style={{
              height: 32,
              paddingLeft: 32,
              paddingRight: 28,
              appearance: "none",
              cursor: "pointer",
              fontSize: 12.5,
            }}
          >
            <option value="createdAt:desc">{t("sortNewest")}</option>
            <option value="createdAt:asc">{t("sortOldest")}</option>
            <option value="clicks:desc">{t("sortMostClicks")}</option>
            <option value="clicks:asc">{t("sortFewestClicks")}</option>
          </select>
          <ArrowUpDown
            size={13}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--ink-500)",
              pointerEvents: "none",
            }}
          />
        </div>
        {allTags.length > 0 && (
          <div style={{ position: "relative" }}>
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="input"
              style={{
                height: 32,
                paddingLeft: 32,
                paddingRight: 28,
                appearance: "none",
                cursor: "pointer",
                fontSize: 12.5,
              }}
            >
              <option value="">
                {t("tags")}: {tCommon("all")}
              </option>
              {allTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name} ({tag._count.links})
                </option>
              ))}
            </select>
            <TagIcon
              size={13}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--ink-500)",
                pointerEvents: "none",
              }}
            />
          </div>
        )}
      </div>

      {/* Batch toolbar */}
      {selectedIds.size > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 10,
            background: "var(--bg-subtle)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            marginBottom: 14,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-200)" }}>
            {selectedIds.size} selected
          </span>
          <div className="row" style={{ marginLeft: "auto", gap: 4, flexWrap: "wrap" }}>
            {allTags.length > 0 && (
              <div style={{ position: "relative" }}>
                <button
                  className="btn"
                  onClick={() => setShowTagDropdown(!showTagDropdown)}
                  disabled={batchLoading || batchTagLoading}
                  style={{
                    height: 28,
                    fontSize: 11.5,
                    background: "var(--brand-50)",
                    color: "var(--brand-700)",
                  }}
                >
                  <TagIcon size={12} /> Add Tag <ChevronDown size={11} />
                </button>
                {showTagDropdown && (
                  <>
                    <div
                      style={{ position: "fixed", inset: 0, zIndex: 40 }}
                      onClick={() => setShowTagDropdown(false)}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        marginTop: 4,
                        background: "#fff",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        boxShadow: "var(--shadow-pop)",
                        minWidth: 160,
                        zIndex: 50,
                        padding: 4,
                      }}
                    >
                      {allTags.map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => handleBatchTag(tag.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                            padding: "6px 10px",
                            fontSize: 12,
                            color: "var(--ink-300)",
                            background: "transparent",
                            border: 0,
                            borderRadius: 5,
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: tag.color || "#94a3b8",
                            }}
                          />
                          {tag.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              className="btn"
              onClick={() => handleBatchAction("activate")}
              disabled={batchLoading}
              style={{ height: 28, fontSize: 11.5, background: "var(--ok-bg)", color: "var(--ok-fg)" }}
            >
              <Play size={12} /> {t("active")}
            </button>
            <button
              className="btn"
              onClick={() => handleBatchAction("pause")}
              disabled={batchLoading}
              style={{ height: 28, fontSize: 11.5, background: "var(--warn-bg)", color: "var(--warn-fg)" }}
            >
              <Pause size={12} /> {t("paused")}
            </button>
            <button
              className="btn"
              onClick={() => handleBatchAction("archive")}
              disabled={batchLoading}
              style={{ height: 28, fontSize: 11.5, background: "var(--neutral-bg)", color: "var(--neutral-fg)" }}
            >
              <Archive size={12} /> {t("archived")}
            </button>
            <button
              className="btn"
              onClick={() => setBatchDeleteConfirm(true)}
              disabled={batchLoading}
              style={{ height: 28, fontSize: 11.5, background: "var(--err-bg)", color: "var(--err-fg)" }}
            >
              <Trash2 size={12} /> {tCommon("delete")}
            </button>
          </div>
          {(batchLoading || batchTagLoading) && (
            <Loader2 size={14} className="animate-spin" style={{ color: "var(--ink-500)" }} />
          )}
        </div>
      )}

      {/* Table */}
      {linksLoading && !linksData ? (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--ink-500)" }} />
        </div>
      ) : links.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Link2 className="w-10 h-10" />}
            title={t("noLinks")}
            description={t("createFirst")}
            action={{ label: t("createNew"), href: "/links/new" }}
          />
        </div>
      ) : (
        <div className="tbl-wrap">
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <button
                    onClick={toggleSelectAll}
                    className={`cbx ${selectedIds.size === links.length && links.length > 0 ? "checked" : ""}`}
                    aria-label="Select all"
                  />
                </th>
                <th>{t("title")}</th>
                <th style={{ width: 160 }}>Campaign</th>
                <th style={{ width: 140 }}>{t("shortUrl")}</th>
                <th style={{ width: 120 }}>{t("tags")}</th>
                <th style={{ width: 100 }}>{t("status")}</th>
                <th className="num" style={{ width: 110 }}>
                  {t("clicks")}
                </th>
                <th style={{ width: 36 }} />
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <LinkTableRow
                  key={link.id}
                  link={link}
                  shortBaseUrl={shortBaseUrl}
                  selected={selectedIds.has(link.id)}
                  onSelect={toggleSelect}
                  onDelete={confirmDelete}
                  onStatusChange={handleStatusChange}
                  onClone={handleClone}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {refreshing && (
        <div
          style={{
            position: "fixed",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 40,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            background: "rgba(11,18,32,0.85)",
            color: "#fff",
            fontSize: 11.5,
            borderRadius: 999,
            boxShadow: "var(--shadow-pop)",
          }}
        >
          <Loader2 size={13} className="animate-spin" />
          <span>更新中…</span>
        </div>
      )}
    </>
  );
}
