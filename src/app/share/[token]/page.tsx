"use client";

import { useState, useEffect, use } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Lock, Loader2, AlertCircle, BarChart3 } from "lucide-react";
import { formatSharePeriod } from "@/lib/share-period";

interface ScopeDescriptor {
  type: "link" | "campaign" | "range";
  shortLinkCode: string | null;
  shortLinkTitle: string | null;
  shortLinkCreatedAt: string | null;
  campaignName: string | null;
  ownerName?: string | null;
  rangeWindow: string | null;
}

type Row = { name: string; value: number };

interface AnalyticsData {
  scope?: ScopeDescriptor;
  link: {
    code: string;
    title: string | null;
    createdAt: string;
  } | null;
  analytics: {
    totalClicks: number;
    clicksByDay: { date: string; clicks: number }[];
    devices: Row[];
    browsers: Row[];
    countries: Row[];
    sources?: Row[];
    mediums?: Row[];
    topLinks?: {
      code: string;
      title: string | null;
      source: string | null;
      medium: string | null;
      content: string | null;
      clicks: number;
    }[];
  };
}

// This page lives outside the [locale] tree (no next-intl provider) and is
// read by managers / partners, so it carries its own two-language table.
// Chinese first — the team and most report readers are in Taiwan.
const STR = {
  zh: {
    shared: "分享報告", linkReport: "連結成效", campaignReport: "活動成效", workspaceReport: "整體成效",
    allTime: "全部期間", last: (n: string) => `近 ${n.replace("d", "")} 天`,
    totalClicks: "總點擊數", clicksOverTime: "每日點擊", channels: "通路表現",
    medium: "媒介 (Medium)", source: "來源 (Source)", topLinks: "連結排行", link: "連結", clicks: "點擊",
    devices: "裝置", browsers: "瀏覽器", countries: "國家", noData: "沒有資料",
    pwTitle: "需要密碼", pwDesc: "請輸入密碼查看這份報告", pwPlaceholder: "輸入密碼", verifying: "驗證中…", view: "查看報告",
    loadFail: "無法載入報告", realOnly: "僅計算真實流量，不含內部測試點擊與疑似郵件掃描點擊", owner: (n: string) => `負責人：${n}`, lang: "EN",
  },
  en: {
    shared: "Shared report", linkReport: "Link performance", campaignReport: "Campaign performance", workspaceReport: "Overall performance",
    allTime: "All time", last: (n: string) => `Last ${n.replace("d", "")} days`,
    totalClicks: "Total clicks", clicksOverTime: "Clicks per day", channels: "Channels",
    medium: "Medium", source: "Source", topLinks: "Top links", link: "Link", clicks: "Clicks",
    devices: "Devices", browsers: "Browsers", countries: "Countries", noData: "No data",
    pwTitle: "Password protected", pwDesc: "Enter the password to view this report", pwPlaceholder: "Password", verifying: "Verifying…", view: "View report",
    loadFail: "Unable to load report", realOnly: "Real traffic only — internal test clicks and suspected email-scanner clicks excluded", owner: (n: string) => `Owner: ${n}`, lang: "中文",
  },
};
type Lang = keyof typeof STR;

function periodLabel(rangeWindow: string | null, s: (typeof STR)[Lang]): string {
  if (rangeWindow && /^\d+d$/.test(rangeWindow)) return s.last(rangeWindow);
  return formatSharePeriod(rangeWindow, s.allTime);
}

function describeScope(s: (typeof STR)[Lang], scope?: ScopeDescriptor, fallback?: AnalyticsData["link"]) {
  if (!scope) {
    return { title: fallback?.title || (fallback ? `/${fallback.code}` : s.shared), subtitle: s.linkReport };
  }
  const period = periodLabel(scope.rangeWindow, s);
  if (scope.type === "link") {
    return { title: scope.shortLinkTitle || `/${scope.shortLinkCode ?? ""}`, subtitle: `${s.linkReport} · ${period}` };
  }
  if (scope.type === "campaign") {
    return {
      title: scope.campaignName ?? s.campaignReport,
      subtitle: `${s.campaignReport} · ${period}${scope.ownerName ? ` · ${s.owner(scope.ownerName)}` : ""}`,
    };
  }
  return { title: s.workspaceReport, subtitle: period };
}

function BarList({ rows, empty }: { rows: Row[]; empty: string }) {
  if (rows.length === 0) return <p className="text-gray-400 text-center py-6">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <div className="space-y-3">
      {rows.slice(0, 10).map((r) => (
        <div key={r.name}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-700 truncate pr-3">{r.name}</span>
            <span className="text-gray-500 tabular-nums">{r.value.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function SharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lang, setLang] = useState<Lang>("zh");
  const L = STR[lang];
  const langToggle = (
    <button
      onClick={() => setLang(lang === "zh" ? "en" : "zh")}
      className="text-xs px-2.5 py-1 border border-gray-200 rounded-md text-gray-500 hover:bg-gray-50"
    >
      {L.lang}
    </button>
  );

  const fetchReport = async (pwd?: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/share/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });

      const result = await response.json();

      if (result.requiresPassword) {
        setRequiresPassword(true);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(result.error || "Failed to load report");
      }

      setData(result);
      setRequiresPassword(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [token]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    fetchReport(password);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (requiresPassword) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">{L.pwTitle}</h1>
            <p className="text-gray-500 mt-1">{L.pwDesc}</p>
          </div>

          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={L.pwPlaceholder}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
              autoFocus
            />
            <button
              type="submit"
              disabled={submitting || !password}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitting ? L.verifying : L.view}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">{L.loadFail}</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const formattedClicksByDay = data.analytics.clicksByDay.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString(lang === "zh" ? "zh-TW" : "en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          {(() => {
            const desc = describeScope(L, data.scope, data.link);
            return (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <BarChart3 className="w-6 h-6 text-blue-600 shrink-0" />
                  <h1 className="text-2xl font-bold text-gray-900 flex-1 min-w-0 break-words">{desc.title}</h1>
                  {langToggle}
                </div>
                <p className="text-gray-500">{desc.subtitle}</p>
                <p className="text-xs text-gray-400 mt-1">{L.realOnly}</p>
              </>
            );
          })()}
        </div>

        {/* Total Clicks */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">{L.totalClicks}</p>
          <p className="text-4xl font-bold text-gray-900">
            {data.analytics.totalClicks.toLocaleString()}
          </p>
        </div>

        {/* Clicks Over Time */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {L.clicksOverTime}
          </h2>
          {formattedClicksByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={formattedClicksByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#888" fontSize={12} />
                <YAxis stroke="#888" fontSize={12} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="clicks"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              {L.noData}
            </div>
          )}
        </div>

        {/* Channels — what managers ask first: which channel worked */}
        {(data.analytics.mediums?.length || data.analytics.sources?.length) ? (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{L.channels}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">{L.medium}</h3>
                <BarList rows={data.analytics.mediums ?? []} empty={L.noData} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">{L.source}</h3>
                <BarList rows={data.analytics.sources ?? []} empty={L.noData} />
              </div>
            </div>
          </div>
        ) : null}

        {data.analytics.topLinks && data.analytics.topLinks.length > 1 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{L.topLinks}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-3 font-medium">{L.link}</th>
                    <th className="py-2 pr-3 font-medium">{L.medium} / {L.source}</th>
                    <th className="py-2 font-medium text-right">{L.clicks}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.analytics.topLinks.map((l) => (
                    <tr key={l.code} className="border-b border-gray-50">
                      <td className="py-2 pr-3">
                        <div className="text-gray-900">{l.title || `/${l.code}`}</div>
                        {l.content && <div className="text-xs text-gray-400">{l.content}</div>}
                      </td>
                      <td className="py-2 pr-3 text-gray-500">{[l.medium, l.source].filter(Boolean).join(" / ") || "—"}</td>
                      <td className="py-2 text-right tabular-nums text-gray-900">{l.clicks.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Distribution Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Devices */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{L.devices}</h2>
            {data.analytics.devices.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={data.analytics.devices}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {data.analytics.devices.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-400">
                {L.noData}
              </div>
            )}
          </div>

          {/* Browsers */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{L.browsers}</h2>
            {data.analytics.browsers.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={data.analytics.browsers}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {data.analytics.browsers.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-400">
                {L.noData}
              </div>
            )}
          </div>
        </div>

        {/* Countries */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{L.countries}</h2>
          <BarList rows={data.analytics.countries} empty={L.noData} />
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-400 py-4">
          EnGenius ShortLink
        </div>
      </div>
    </div>
  );
}
