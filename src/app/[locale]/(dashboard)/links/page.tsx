"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/routing";
import { useDebounce } from "@/hooks/useDebounce";
import { LinkTableRow } from "@/components/links/LinkTableRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { Plus, Search, Loader2, Link2, Layers, ChevronLeft, ChevronRight, Tag, Trash2, Pause, Play, Archive, Download, ArrowUpDown, Check, ChevronDown } from "lucide-react";
import { CampaignFilter } from "@/components/campaigns/CampaignFilter";

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
  utmCampaign?: string | null;
  clicksLast7d?: number;
  trendPct?: number | null;
  _count: { clicks: number };
  tags?: LinkTag[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function LinksPage() {
  const t = useTranslations("links");
  const tCommon = useTranslations("common");
  const { success, error: toastError } = useToast();
  const searchParams = useSearchParams();

  const [links, setLinks] = useState<ShortLink[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [allTags, setAllTags] = useState<TagOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [campaignFilter, setCampaignFilter] = useState(searchParams.get("campaign") || "");

  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);

  // Batch tag state
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [batchTagLoading, setBatchTagLoading] = useState(false);

  // Fetch tags for filter
  useEffect(() => {
    async function fetchTags() {
      try {
        const response = await fetch("/api/tags");
        if (response.ok) {
          const data = await response.json();
          setAllTags(data.tags || []);
        }
      } catch (err) {
        console.error("Failed to fetch tags:", err);
      }
    }
    fetchTags();
  }, []);

  const shortBaseUrl = process.env.NEXT_PUBLIC_SHORT_URL || "http://localhost:3000/s";

  const fetchLinks = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString() });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter) params.set("status", statusFilter);
      if (campaignFilter) params.set("campaign", campaignFilter);
      if (tagFilter) params.set("tagId", tagFilter);
      if (sortBy !== "createdAt") params.set("sortBy", sortBy);
      if (sortOrder !== "desc") params.set("sortOrder", sortOrder);

      const response = await fetch(`/api/links?${params}`);
      const data = await response.json();

      setLinks(data.links || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error("Failed to fetch links:", err);
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, campaignFilter, tagFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks, searchParams]);

  // Called from row — opens confirm modal
  const confirmDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  // Executes actual single delete after modal confirm
  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    try {
      const response = await fetch(`/api/links/${id}`, { method: "DELETE" });
      if (response.ok) {
        setLinks((prev) => prev.filter((link) => link.id !== id));
        success("Link deleted.");
      } else {
        toastError("Failed to delete link.");
      }
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
        setLinks((prev) =>
          prev.map((link) => (link.id === id ? { ...link, status } : link))
        );
        success(status === "ACTIVE" ? "Link activated." : status === "PAUSED" ? "Link paused." : "Link archived.");
      } else {
        toastError("Failed to update status.");
      }
    } catch {
      toastError("Failed to update status.");
    }
  };

  const handleClone = async (id: string) => {
    try {
      const response = await fetch(`/api/links/${id}/clone`, { method: "POST" });
      if (response.ok) {
        fetchLinks(pagination?.page || 1);
        success("Link cloned successfully.");
      } else {
        toastError("Failed to clone link.");
      }
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
    if (selectedIds.size === links.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(links.map((l) => l.id)));
    }
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
        fetchLinks(pagination?.page || 1);
        success(`Tag added to ${selectedIds.size} link${selectedIds.size > 1 ? "s" : ""}.`);
      } else {
        toastError("Failed to add tag.");
      }
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
        fetchLinks(pagination?.page || 1);
        success(`${count} link${count > 1 ? "s" : ""} deleted.`);
      } else {
        toastError("Batch delete failed.");
      }
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
        fetchLinks(pagination?.page || 1);
        const label = action === "activate" ? "activated" : action === "pause" ? "paused" : "archived";
        success(`${count} link${count > 1 ? "s" : ""} ${label}.`);
      } else {
        toastError("Batch action failed.");
      }
    } catch {
      toastError("Batch action failed.");
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Delete confirmation modals — rendered outside pagination so they always work */}
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t("title")}</h1>
          {pagination && (
            <p className="text-sm text-slate-500 mt-0.5">
              {pagination.total} {pagination.total === 1 ? "link" : "links"}
              {campaignFilter && campaignFilter !== "__none__" && (
                <span className="text-slate-400"> in <span className="font-mono">{campaignFilter}</span></span>
              )}
              {campaignFilter === "__none__" && (
                <span className="text-slate-400"> without campaign</span>
              )}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/export/links${statusFilter ? `?status=${statusFilter}` : ""}`}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            {tCommon("export")}
          </a>
          <Link
            href="/links/new"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("createNew")}
          </Link>
          <Link
            href="/links/batch"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#03A9F4] text-white text-sm font-medium rounded-lg hover:bg-[#0288D1] transition-colors"
          >
            <Layers className="w-4 h-4" />
            Batch Create
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tCommon("search")}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] text-sm"
          />
        </div>
        <CampaignFilter
          value={campaignFilter}
          onChange={setCampaignFilter}
          showNoCampaign
        />
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
          {["", "ACTIVE", "PAUSED", "ARCHIVED"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${statusFilter === status
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
                }`}
            >
              {status === "" ? tCommon("all") : status === "ACTIVE" ? t("active") : status === "PAUSED" ? t("paused") : t("archived")}
            </button>
          ))}
        </div>
        <div className="relative">
          <select
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [by, order] = e.target.value.split(":");
              setSortBy(by);
              setSortOrder(order);
            }}
            className="appearance-none pl-8 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] cursor-pointer"
          >
            <option value="createdAt:desc">{t("sortNewest")}</option>
            <option value="createdAt:asc">{t("sortOldest")}</option>
            <option value="clicks:desc">{t("sortMostClicks")}</option>
            <option value="clicks:asc">{t("sortFewestClicks")}</option>
          </select>
          <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
        {allTags.length > 0 && (
          <div className="relative">
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="appearance-none pl-8 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] cursor-pointer"
            >
              <option value="">{t("tags")}: {tCommon("all")}</option>
              {allTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name} ({tag._count.links})
                </option>
              ))}
            </select>
            <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Batch Actions Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-sm font-medium text-slate-700">
            {selectedIds.size} selected
          </span>
          <div className="flex gap-1 ml-auto flex-wrap">
            {/* Add Tag dropdown */}
            {allTags.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowTagDropdown(!showTagDropdown)}
                  disabled={batchLoading || batchTagLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 rounded-lg hover:bg-sky-100 transition-colors disabled:opacity-50"
                >
                  <Tag className="w-3.5 h-3.5" />
                  Add Tag
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showTagDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowTagDropdown(false)} />
                    <div className="absolute top-full mt-1 left-0 z-50 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[140px]">
                      {allTags.map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => handleBatchTag(tag.id)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: tag.color || "#94a3b8" }}
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
              onClick={() => handleBatchAction("activate")}
              disabled={batchLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              {t("active")}
            </button>
            <button
              onClick={() => handleBatchAction("pause")}
              disabled={batchLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
            >
              <Pause className="w-3.5 h-3.5" />
              {t("paused")}
            </button>
            <button
              onClick={() => handleBatchAction("archive")}
              disabled={batchLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              <Archive className="w-3.5 h-3.5" />
              {t("archived")}
            </button>
            <button
              onClick={() => setBatchDeleteConfirm(true)}
              disabled={batchLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {tCommon("delete")}
            </button>
          </div>
          {(batchLoading || batchTagLoading) && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        </div>
      )}

      {/* Links Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400 mb-2" />
          <p className="text-sm text-slate-500">{tCommon("loading")}</p>
        </div>
      ) : links.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100">
          <EmptyState
            icon={<Link2 className="w-10 h-10" />}
            title={t("noLinks")}
            description={t("createFirst")}
            action={{ label: t("createNew"), href: "/links/new" }}
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pl-4 pr-2 py-2.5 w-10">
                    <button
                      onClick={toggleSelectAll}
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${selectedIds.size === links.length && links.length > 0
                          ? "bg-[#03A9F4] border-[#03A9F4] text-white"
                          : "border-slate-300 hover:border-slate-400"
                        }`}
                    >
                      {selectedIds.size === links.length && links.length > 0 && (
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  </th>
                  <th className="py-2.5 pr-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    {t("title")}
                  </th>
                  <th className="py-2.5 pr-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Campaign
                  </th>
                  <th className="py-2.5 pr-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    {t("shortUrl")}
                  </th>
                  <th className="py-2.5 pr-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    {t("tags")}
                  </th>
                  <th className="py-2.5 pr-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    {t("status")}
                  </th>
                  <th className="py-2.5 pr-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    {t("clicks")} <span className="text-[10px] normal-case font-normal text-slate-300">7d ↑↓</span>
                  </th>
                  <th className="py-2.5 pr-3 w-10" />
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
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => fetchLinks(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            {tCommon("previous")}
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              let pageNum;
              if (pagination.totalPages <= 5) {
                pageNum = i + 1;
              } else if (pagination.page <= 3) {
                pageNum = i + 1;
              } else if (pagination.page >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + i;
              } else {
                pageNum = pagination.page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => fetchLinks(pageNum)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${pagination.page === pageNum
                      ? "bg-[#03A9F4] text-white"
                      : "text-slate-600 hover:bg-slate-100"
                    }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => fetchLinks(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {tCommon("next")}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
