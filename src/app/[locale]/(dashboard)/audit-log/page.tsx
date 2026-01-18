"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Shield,
  Link2,
  FileText,
  Share2,
  Trash2,
  Edit,
  Plus,
  RotateCcw,
  ChevronDown,
} from "lucide-react";

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: {
    name: string | null;
    email: string;
    image: string | null;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const actionIcons: Record<string, React.ReactNode> = {
  CREATE_LINK: <Plus className="w-4 h-4 text-green-600" />,
  UPDATE_LINK: <Edit className="w-4 h-4 text-blue-600" />,
  DELETE_LINK: <Trash2 className="w-4 h-4 text-red-600" />,
  RESTORE_LINK: <RotateCcw className="w-4 h-4 text-purple-600" />,
  CREATE_TEMPLATE: <Plus className="w-4 h-4 text-green-600" />,
  UPDATE_TEMPLATE: <Edit className="w-4 h-4 text-blue-600" />,
  DELETE_TEMPLATE: <Trash2 className="w-4 h-4 text-red-600" />,
  SHARE_LINK: <Share2 className="w-4 h-4 text-cyan-600" />,
  REVOKE_SHARE: <Shield className="w-4 h-4 text-orange-600" />,
};

const actionLabels: Record<string, string> = {
  CREATE_LINK: "Created link",
  UPDATE_LINK: "Updated link",
  DELETE_LINK: "Deleted link",
  RESTORE_LINK: "Restored link",
  CREATE_TEMPLATE: "Created template",
  UPDATE_TEMPLATE: "Updated template",
  DELETE_TEMPLATE: "Deleted template",
  SHARE_LINK: "Shared link",
  REVOKE_SHARE: "Revoked share",
};

const actionFilters = [
  { value: "", label: "All Actions" },
  { value: "CREATE_LINK", label: "Create Link" },
  { value: "UPDATE_LINK", label: "Update Link" },
  { value: "DELETE_LINK", label: "Delete Link" },
  { value: "CREATE_TEMPLATE", label: "Create Template" },
  { value: "UPDATE_TEMPLATE", label: "Update Template" },
  { value: "DELETE_TEMPLATE", label: "Delete Template" },
  { value: "SHARE_LINK", label: "Share Link" },
];

export default function AuditLogPage() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString() });
      if (actionFilter) params.set("action", actionFilter);

      const response = await fetch(`/api/audit-log?${params}`);
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Access denied - Admin or Manager role required");
        }
        throw new Error("Failed to fetch audit logs");
      }

      const data = await response.json();
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <Shield className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{t("auditLog")}</h1>

        <div className="relative">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {actionFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No audit logs found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    {actionIcons[log.action] || (
                      <FileText className="w-4 h-4 text-gray-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">
                        {log.user.name || log.user.email}
                      </span>
                      <span className="text-gray-500">
                        {actionLabels[log.action] || log.action}
                      </span>
                    </div>

                    {log.metadata && (
                      <div className="text-sm text-gray-500">
                        {log.metadata.code && (
                          <span className="inline-flex items-center gap-1">
                            <Link2 className="w-3 h-3" />
                            /{String(log.metadata.code)}
                          </span>
                        )}
                        {log.metadata.name && (
                          <span>"{String(log.metadata.name)}"</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-sm text-gray-400 whitespace-nowrap">
                    {formatDate(log.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => fetchLogs(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {tCommon("previous")}
          </button>
          <span className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => fetchLogs(pagination.page + 1)}
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
