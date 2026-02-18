"use client";

import { useState, useEffect } from "react";
import { Megaphone, Loader2, ChevronDown } from "lucide-react";

interface CampaignOption {
  name: string;
  linkCount: number;
}

interface CampaignFilterProps {
  value: string; // "" = all, "__none__" = no campaign, otherwise campaign name
  onChange: (value: string) => void;
  showNoCampaign?: boolean;
}

export function CampaignFilter({ value, onChange, showNoCampaign = false }: CampaignFilterProps) {
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCampaigns() {
      try {
        const response = await fetch("/api/utm-campaigns?limit=100");
        if (response.ok) {
          const data = await response.json();
          setCampaigns(data.campaigns || []);
        }
      } catch (err) {
        console.error("Failed to fetch campaigns:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCampaigns();
  }, []);

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className="appearance-none pl-8 pr-7 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-[#03A9F4] focus:border-[#03A9F4] cursor-pointer disabled:opacity-50"
      >
        <option value="">Campaign: All</option>
        {showNoCampaign && <option value="__none__">No Campaign</option>}
        {campaigns.map((c) => (
          <option key={c.name} value={c.name}>
            {c.name} ({c.linkCount})
          </option>
        ))}
      </select>
      <Megaphone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      {loading ? (
        <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin pointer-events-none" />
      ) : (
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      )}
    </div>
  );
}
