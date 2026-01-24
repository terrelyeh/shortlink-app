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
  TrendingUp,
  Calendar,
  ArrowUpRight,
  BarChart3,
} from "lucide-react";

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
  const avgClicksPerLink = totalLinks > 0 ? (totalClicks / totalLinks).toFixed(1) : "0";

  const handleCampaignClick = (campaignName: string) => {
    // Navigate to links page filtered by this campaign
    router.push(`/links?campaign=${encodeURIComponent(campaignName)}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#03A9F4]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("subtitle")}</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-[#03A9F4]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{campaigns.length}</p>
              <p className="text-sm text-slate-500">{t("title")}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Link2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{totalLinks}</p>
              <p className="text-sm text-slate-500">{t("linksCount")}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
              <MousePointerClick className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{totalClicks.toLocaleString()}</p>
              <p className="text-sm text-slate-500">{t("clicksCount")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4]"
          />
        </div>
      </div>

      {/* Campaign List */}
      {campaigns.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center shadow-sm">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-sky-50 to-sky-100 rounded-2xl flex items-center justify-center mb-4">
            <BarChart3 className="w-8 h-8 text-[#03A9F4]" />
          </div>
          <p className="text-slate-700 font-medium mb-2">{t("emptyState.title")}</p>
          <p className="text-sm text-slate-500 mb-4 max-w-md mx-auto">
            {t("emptyState.description")}
          </p>
          <button
            onClick={() => router.push("/links/new")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#03A9F4] text-white rounded-lg hover:bg-[#0288D1] transition-colors"
          >
            <Link2 className="w-5 h-5" />
            {t("emptyState.createFirst")}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-sm font-semibold text-slate-600">
                    {t("name")}
                  </th>
                  <th className="text-center px-5 py-3 text-sm font-semibold text-slate-600">
                    <div className="flex items-center justify-center gap-1.5">
                      <Link2 className="w-4 h-4" />
                      {t("linksCount")}
                    </div>
                  </th>
                  <th className="text-center px-5 py-3 text-sm font-semibold text-slate-600">
                    <div className="flex items-center justify-center gap-1.5">
                      <MousePointerClick className="w-4 h-4" />
                      {t("clicksCount")}
                    </div>
                  </th>
                  <th className="text-center px-5 py-3 text-sm font-semibold text-slate-600">
                    <div className="flex items-center justify-center gap-1.5">
                      <TrendingUp className="w-4 h-4" />
                      CTR
                    </div>
                  </th>
                  <th className="text-right px-5 py-3 text-sm font-semibold text-slate-600">
                    <div className="flex items-center justify-end gap-1.5">
                      <Calendar className="w-4 h-4" />
                      {t("endDate")}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign, index) => {
                  const ctr = campaign.linkCount > 0
                    ? (campaign.clickCount / campaign.linkCount).toFixed(1)
                    : "0";

                  return (
                    <tr
                      key={campaign.name}
                      onClick={() => handleCampaignClick(campaign.name)}
                      className={`border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${
                        index % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-sky-100 to-sky-200 rounded-lg flex items-center justify-center">
                            <Megaphone className="w-4 h-4 text-[#0288D1]" />
                          </div>
                          <div>
                            <p className="font-mono text-sm font-medium text-slate-900">
                              {campaign.name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium">
                          {campaign.linkCount}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[3rem] px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium">
                          {campaign.clickCount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 bg-violet-100 text-violet-700 rounded-lg text-sm font-medium">
                          {ctr}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-sm text-slate-500">
                            {new Date(campaign.lastUsed).toLocaleDateString()}
                          </span>
                          <ArrowUpRight className="w-4 h-4 text-slate-400" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
