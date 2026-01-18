"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { LinkCard } from "@/components/links/LinkCard";
import { Plus, Search, Filter, Loader2, Link2, Layers } from "lucide-react";

interface ShortLink {
  id: string;
  code: string;
  originalUrl: string;
  title: string | null;
  status: string;
  createdAt: string;
  _count: { clicks: number };
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

  const [links, setLinks] = useState<ShortLink[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const shortBaseUrl = process.env.NEXT_PUBLIC_SHORT_URL || "http://localhost:3000/s";

  const fetchLinks = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString() });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);

      const response = await fetch(`/api/links?${params}`);
      const data = await response.json();

      setLinks(data.links);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Failed to fetch links:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLinks();
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/links/${id}`, { method: "DELETE" });
      if (response.ok) {
        setLinks(links.filter((link) => link.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete link:", error);
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
        setLinks(
          links.map((link) =>
            link.id === id ? { ...link, status } : link
          )
        );
      }
    } catch (error) {
      console.error("Failed to update link:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <div className="flex gap-2">
          <Link
            href="/links/batch"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Layers className="w-5 h-5" />
            Batch Create
          </Link>
          <Link
            href="/links/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            {t("createNew")}
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tCommon("search")}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </form>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        >
          <option value="">{tCommon("all")} Status</option>
          <option value="ACTIVE">{t("active")}</option>
          <option value="PAUSED">{t("paused")}</option>
          <option value="ARCHIVED">{t("archived")}</option>
        </select>
      </div>

      {/* Links List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : links.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Link2 className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 mb-4">{t("noLinks")}</p>
          <Link
            href="/links/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            {t("createFirst")}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {links.map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              shortBaseUrl={shortBaseUrl}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => fetchLinks(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {tCommon("previous")}
          </button>
          <span className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => fetchLinks(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {tCommon("next")}
          </button>
        </div>
      )}
    </div>
  );
}
