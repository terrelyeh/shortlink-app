"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Loader2,
  Megaphone,
  Search,
  Link2,
  MousePointerClick,
  BarChart3,
  Plus,
  Info,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

interface CampaignEntity {
  id: string;
  name: string;
  displayName: string | null;
  description: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  defaultSource: string | null;
  defaultMedium: string | null;
  linkCount: number;
  tags: { id: string; name: string }[];
}

function statusColor(status: string) {
  switch (status) {
    case "ACTIVE": return "bg-emerald-400";
    case "DRAFT": return "bg-slate-300";
    case "COMPLETED": return "bg-sky-400";
    case "ARCHIVED": return "bg-slate-300";
    default: return "bg-slate-300";
  }
}

function statusBg(status: string) {
  switch (status) {
    case "ACTIVE": return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "DRAFT": return "bg-slate-50 text-slate-600 border-slate-200";
    case "COMPLETED": return "bg-sky-50 text-sky-700 border-sky-100";
    case "ARCHIVED": return "bg-slate-50 text-slate-400 border-slate-200";
    default: return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

export default function CampaignsPage() {
  const t = useTranslations("campaigns");
  const router = useRouter();

  const [campaigns, setCampaigns] = useState<CampaignEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [showTip, setShowTip] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter) params.set("status", statusFilter);
      if (statusFilter === "" || statusFilter === "ARCHIVED") params.set("includeArchived", "true");

      const response = await fetch(`/api/campaigns?${params}`);
      const data = await response.json();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Calculate totals
  const totalLinks = campaigns.reduce((sum, c) => sum + c.linkCount, 0);

  const handleCampaignClick = (campaignName: string) => {
    router.push(`/campaigns/${encodeURIComponent(campaignName)}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <button
            onClick={() => router.push("/links/new")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#03A9F4] text-white text-sm font-medium rounded-lg hover:bg-[#0288D1] transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("createLinkWithUTM")}
          </button>
        }
      />

      {/* Inline stats */}
      {campaigns.length > 0 && (
        <div className="flex items-center gap-6 text-sm text-slate-500 pb-4 border-b border-slate-100">
          <span className="flex items-center gap-1.5">
            <Megaphone className="w-4 h-4 text-slate-400" />
            <span className="font-medium text-slate-900">{campaigns.length}</span> {t("title")}
          </span>
          <span className="flex items-center gap-1.5">
            <Link2 className="w-4 h-4 text-slate-400" />
            <span className="font-medium text-slate-900">{totalLinks}</span> {t("linksCount")}
          </span>
        </div>
      )}

      {/* Educational callout */}
      {showTip && campaigns.length === 0 && (
        <div className="flex items-start gap-3 bg-sky-50/50 border-l-2 border-[#03A9F4] rounded-r-lg p-4">
          <Info className="w-4 h-4 text-[#03A9F4] mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-slate-700">{t("howItWorks")}</p>
            <button
              onClick={() => router.push("/links/new")}
              className="text-sm font-medium text-[#03A9F4] hover:text-[#0288D1] mt-1"
            >
              {t("createLinkWithUTM")} →
            </button>
          </div>
          <button onClick={() => setShowTip(false)} className="p-1 hover:bg-sky-100 rounded">
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      )}

      {/* Campaign List */}
      {campaigns.length === 0 && !debouncedSearch && !statusFilter ? (
        <EmptyState
          icon={<BarChart3 className="w-10 h-10" />}
          title={t("emptyState.title")}
          description={t("emptyState.description")}
          action={{ label: t("emptyState.createFirst"), href: "/links/new" }}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-100">
          {/* Search + Status filter */}
          <div className="px-4 pt-4 pb-3 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
              />
            </div>
            <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
              {["", "ACTIVE", "DRAFT", "COMPLETED", "ARCHIVED"].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    statusFilter === status
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {status === "" ? t("allStatuses") || "All" :
                   status === "ACTIVE" ? t("statusActive") :
                   status === "DRAFT" ? t("statusDraft") :
                   status === "COMPLETED" ? t("statusCompleted") :
                   t("statusArchived")}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pl-4 py-2 pr-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    {t("name")}
                  </th>
                  <th className="py-2 pr-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    {t("status")}
                  </th>
                  <th className="py-2 pr-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    {t("sourceMedium")}
                  </th>
                  <th className="py-2 pr-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    {t("linksCount")}
                  </th>
                  <th className="py-2 pr-4 w-36" />
                </tr>
              </thead>
              <tbody>
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                      {t("emptyState.title")}
                    </td>
                  </tr>
                ) : campaigns.map((campaign) => (
                  <tr
                    key={campaign.id}
                    className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="pl-4 py-2.5 pr-3">
                      <div>
                        <span className="font-mono text-sm font-medium text-slate-900">
                          {campaign.name}
                        </span>
                        {campaign.displayName && (
                          <p className="text-xs text-slate-400 mt-0.5">{campaign.displayName}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${statusBg(campaign.status)}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusColor(campaign.status)}`} />
                        {campaign.status === "ACTIVE" ? t("statusActive") :
                         campaign.status === "DRAFT" ? t("statusDraft") :
                         campaign.status === "COMPLETED" ? t("statusCompleted") :
                         t("statusArchived")}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {campaign.defaultSource && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-50 text-cyan-700 border border-cyan-100">
                            {campaign.defaultSource}
                          </span>
                        )}
                        {campaign.defaultMedium && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-700 border border-violet-100">
                            {campaign.defaultMedium}
                          </span>
                        )}
                        {!campaign.defaultSource && !campaign.defaultMedium && (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-right text-sm text-slate-600 tabular-nums">
                      {campaign.linkCount}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => router.push(`/links?campaign=${encodeURIComponent(campaign.name)}`)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                        >
                          Links
                        </button>
                        <button
                          onClick={() => handleCampaignClick(campaign.name)}
                          className="px-2.5 py-1 text-xs font-medium text-[#03A9F4] border border-sky-200 rounded-md hover:bg-sky-50 transition-colors"
                        >
                          Analytics
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
