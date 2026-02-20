"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import {
  Loader2,
  Megaphone,
  Search,
  Link2,
  MousePointerClick,
  Calendar,
  ArrowUpRight,
  BarChart3,
  Plus,
  Info,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

interface CampaignStats {
  name: string;
  linkCount: number;
  clickCount: number;
  lastUsed: string;
}

export default function CampaignsPage() {
  const t = useTranslations("campaigns");
  const router = useRouter();

  const [campaigns, setCampaigns] = useState<CampaignStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTip, setShowTip] = useState(true);

  const fetchCampaigns = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      params.set("limit", "100");

      const response = await fetch(`/api/utm-campaigns?${params}`);
      const data = await response.json();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [searchQuery]);

  // Calculate totals
  const totalLinks = campaigns.reduce((sum, c) => sum + c.linkCount, 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + c.clickCount, 0);

  const handleCampaignClick = (campaignName: string) => {
    router.push(`/links?campaign=${encodeURIComponent(campaignName)}`);
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
          <span className="flex items-center gap-1.5">
            <MousePointerClick className="w-4 h-4 text-slate-400" />
            <span className="font-medium text-slate-900">{totalClicks.toLocaleString()}</span> {t("clicksCount")}
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
      {campaigns.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="w-10 h-10" />}
          title={t("emptyState.title")}
          description={t("emptyState.description")}
          action={{ label: t("emptyState.createFirst"), href: "/links/new" }}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-100">
          {/* Search bar inside table card */}
          <div className="px-4 pt-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pl-4 py-2.5 pr-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    {t("name")}
                  </th>
                  <th className="py-2.5 pr-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    {t("linksCount")}
                  </th>
                  <th className="py-2.5 pr-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    {t("clicksCount")}
                  </th>
                  <th className="py-2.5 pr-4 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    {t("endDate")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr
                    key={campaign.name}
                    onClick={() => handleCampaignClick(campaign.name)}
                    className="group border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors"
                  >
                    <td className="pl-4 py-2.5 pr-3">
                      <span className="font-mono text-sm font-medium text-slate-900">
                        {campaign.name}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right text-sm text-slate-600 tabular-nums">
                      {campaign.linkCount}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-sm font-medium text-slate-900 tabular-nums">
                      {campaign.clickCount.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-slate-400 tabular-nums">
                          {new Date(campaign.lastUsed).toLocaleDateString()}
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
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
