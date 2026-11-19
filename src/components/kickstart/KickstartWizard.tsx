"use client";

/**
 * Campaign Kickstart — a guided, one-question-per-screen version of the
 * campaign-link-planner skill: type → basics → destination → channels →
 * goals → review → create. Naming (utm_*, short codes, titles, tags) is
 * generated from lib/kickstart, so marketers never type UTM values.
 *
 * Creation goes through the CSV import endpoint (/api/links/batch-csv) in
 * one request — it already handles tags by name, custom codes and the UTM
 * whitelist per row — then the campaign's period / owner / goals are set
 * with PATCH /api/utm-campaigns/[name].
 */

import { useMemo, useState } from "react";
import Papa from "papaparse";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  Megaphone,
  Plus,
  Presentation,
  Rocket,
  X,
  AlertTriangle,
} from "lucide-react";
import { TEMPLATES, type CampaignType, type Phase, type TemplateChannel } from "@/lib/kickstart/templates";
import { CODE_RE, cleanCampaign, cleanCode, codePrefix, suggestCampaign } from "@/lib/kickstart/naming";
import { storedDateToDay } from "@/lib/campaign-period";
import { parseGoalByMedium } from "@/lib/campaign-goal";
import { ownerLabel, useWorkspaceMembers, type OwnerInfo } from "@/components/campaigns/CampaignOwner";
import type { RawAnalyticsData } from "@/lib/analytics/compute";

type StepId = "type" | "basics" | "destination" | "channels" | "goals" | "review";
const STEPS: StepId[] = ["type", "basics", "destination", "channels", "goals", "review"];

interface PlanRow {
  id: string;
  channel: TemplateChannel;
  /** 1 for the template row, 2+ for "add another" copies. */
  n: number;
  include: boolean;
  /** Overrides; null / "" = use the generated value. */
  title: string | null;
  content: string | null;
  code: string | null;
  url: string;
}

interface SummaryCampaign {
  id: string | null;
  name: string;
  startDate: string | null;
  endDate: string | null;
  owner: OwnerInfo | null;
}

interface CreateResult {
  rowId: string;
  ok: boolean;
  code?: string;
  error?: string;
}

const shortBase = process.env.NEXT_PUBLIC_SHORT_URL || "http://localhost:3000/s";

const todayDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function buildRows(type: CampaignType): PlanRow[] {
  return TEMPLATES[type].channels.map((c) => ({
    id: c.key,
    channel: c,
    n: 1,
    include: c.on,
    title: null,
    content: null,
    code: null,
    url: "",
  }));
}

export function KickstartWizard() {
  const t = useTranslations("kickstart");
  const tCommon = useTranslations("common");
  const qc = useQueryClient();
  const { data: session } = useSession();
  const myId = session?.user?.id ?? "";
  const { data: members } = useWorkspaceMembers();

  const [step, setStep] = useState<StepId>("type");
  const stepIdx = STEPS.indexOf(step);

  // --- answers ---
  const [type, setType] = useState<CampaignType | null>(null);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [displayName, setDisplayName] = useState("");
  const [campaignOverride, setCampaignOverride] = useState<string | null>(null);
  const [existingName, setExistingName] = useState("");
  const [startDay, setStartDay] = useState("");
  const [endDay, setEndDay] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(null); // null = default (me)
  const [landingUrl, setLandingUrl] = useState("");
  const [pagePending, setPagePending] = useState(false);
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [goals, setGoals] = useState<Record<string, string>>({});

  // --- create ---
  const [creating, setCreating] = useState(false);
  const [results, setResults] = useState<CreateResult[] | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const effectiveOwner = ownerId ?? myId;

  // Existing campaigns — same key / fetch as the campaign list's default view.
  const { data: summary } = useQuery<{ campaigns: SummaryCampaign[] }>({
    queryKey: ["campaigns-summary", "period"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/campaigns-summary?days=730");
      if (!res.ok) throw new Error("Failed to fetch campaigns summary");
      return res.json();
    },
  });
  const existingCampaigns = useMemo(
    () => (summary?.campaigns ?? []).filter((c) => c.id).sort((a, b) => a.name.localeCompare(b.name)),
    [summary],
  );

  const campaign =
    mode === "existing"
      ? existingName
      : (campaignOverride ?? (type ? suggestCampaign(type, displayName, startDay || null) : ""));
  const nameTaken = mode === "new" && existingCampaigns.some((c) => c.name === campaign);
  const prefix = codePrefix(campaign || "c");
  const label = displayName.trim() || campaign;

  // Links already in an existing campaign (skip their channel combos).
  // Same key / shape as the campaign page's Links tab.
  const { data: existingLinks } = useQuery<{ id: string; code: string; utmSource: string | null; utmMedium: string | null; utmContent: string | null }[]>({
    queryKey: ["campaign-links", existingName, "real-only"],
    enabled: mode === "existing" && Boolean(existingName),
    queryFn: async () => {
      const params = new URLSearchParams({ campaign: existingName, limit: "100", sortBy: "clicks", sortOrder: "desc" });
      const res = await fetch(`/api/links?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load links");
      return (await res.json()).links ?? [];
    },
  });
  const existingCombo = useMemo(() => {
    const m = new Map<string, string>();
    if (mode !== "existing") return m;
    for (const l of existingLinks ?? []) m.set(`${l.utmSource}|${l.utmMedium}|${l.utmContent}`, l.code);
    return m;
  }, [existingLinks, mode]);

  // --- derived row values ---
  const rowContent = (r: PlanRow) => r.content?.trim() || (r.n > 1 ? `${r.channel.content}_${r.n}` : r.channel.content);
  const rowCode = (r: PlanRow) =>
    r.code !== null ? r.code : `${prefix}-${r.channel.code}${r.n > 1 ? `-${r.n}` : ""}`;
  const rowTitle = (r: PlanRow) =>
    r.title?.trim() || `${label}｜${t(`channels.${r.channel.key}`)}${r.n > 1 ? ` #${r.n}` : ""}`;
  const rowUrl = (r: PlanRow) => r.url.trim() || landingUrl.trim();
  const rowExisting = (r: PlanRow) => existingCombo.get(`${r.channel.source}|${r.channel.medium}|${rowContent(r)}`);
  const rowTags = (r: PlanRow) => {
    const tags: string[] = [];
    if (r.channel.phase !== "extra") tags.push(t(`phaseTag.${r.channel.phase}`));
    if (pagePending && !r.url.trim()) tags.push(t("pagePendingTag"));
    return tags;
  };

  const planRows = rows.filter((r) => r.include && !rowExisting(r) && !results?.some((x) => x.rowId === r.id && x.ok));
  const mediums = Array.from(new Set(planRows.map((r) => r.channel.medium)));

  // Reference for goals: average clicks per link, per medium, across the
  // workspace's other campaigns (same raw payload the dashboards use).
  const { data: raw, isLoading: rawLoading } = useQuery<RawAnalyticsData>({
    queryKey: ["analytics-raw", "real-only"],
    enabled: step === "goals",
    queryFn: async () => {
      const res = await fetch("/api/analytics/raw");
      if (!res.ok) throw new Error("Failed to load raw analytics");
      return res.json();
    },
  });
  const perLinkAvg = useMemo(() => {
    const out: Record<string, number> = {};
    if (!raw) return out;
    const clicks = new Map<string, number>();
    for (const c of raw.clicks) clicks.set(c.shortLinkId, (clicks.get(c.shortLinkId) ?? 0) + 1);
    const sum: Record<string, { clicks: number; links: number }> = {};
    for (const l of raw.links) {
      if (!l.utmCampaign || !l.utmMedium || l.utmCampaign === campaign) continue;
      const s = (sum[l.utmMedium] ??= { clicks: 0, links: 0 });
      s.clicks += clicks.get(l.id) ?? 0;
      s.links += 1;
    }
    for (const [m, s] of Object.entries(sum)) if (s.links > 0) out[m] = Math.round(s.clicks / s.links);
    return out;
  }, [raw, campaign]);
  const suggestedGoal = (m: string) => {
    const avg = perLinkAvg[m];
    const n = planRows.filter((r) => r.channel.medium === m).length;
    return avg ? avg * n : null;
  };

  // Short-code availability (review step) — one request per unique code.
  const codes = step === "review" ? Array.from(new Set(planRows.map(rowCode).filter((c) => CODE_RE.test(c)))).sort() : [];
  const { data: codeStatus } = useQuery<Record<string, boolean>>({
    queryKey: ["kickstart-code-check", codes],
    enabled: codes.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const entries = await Promise.all(
        codes.map(async (c) => {
          const res = await fetch(`/api/links/check-code?code=${encodeURIComponent(c)}`);
          const d = await res.json().catch(() => ({}));
          return [c, d.available !== false] as const;
        }),
      );
      return Object.fromEntries(entries);
    },
  });

  // --- validation per step ---
  const urlOk = (u: string) => /^https?:\/\/\S+\.\S+/i.test(u.trim());
  const datesOk = !startDay || !endDay || startDay <= endDay;
  const canNext: Record<StepId, boolean> = {
    type: Boolean(type),
    basics: campaign.length >= 3 && !nameTaken && datesOk && (mode === "new" ? Boolean(displayName.trim()) : Boolean(existingName)),
    destination: urlOk(landingUrl),
    channels: planRows.length > 0 && planRows.every((r) => !r.url.trim() || urlOk(r.url)),
    goals: true,
    review: false,
  };
  const codeCounts = new Map<string, number>();
  for (const r of planRows) {
    const c = rowCode(r);
    if (c) codeCounts.set(c, (codeCounts.get(c) ?? 0) + 1);
  }
  const rowCodeProblem = (r: PlanRow): string | null => {
    const c = rowCode(r);
    if (!c) return null; // random code
    if (!CODE_RE.test(c)) return t("codeInvalid");
    if ((codeCounts.get(c) ?? 0) > 1) return t("codeDuplicate");
    if (codeStatus && codeStatus[c] === false) return t("codeTaken");
    return null;
  };
  const canCreate =
    !creating &&
    planRows.length > 0 &&
    planRows.every((r) => urlOk(rowUrl(r)) && !rowCodeProblem(r));

  const go = (s: StepId) => {
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // --- handlers ---
  const chooseType = (tp: CampaignType) => {
    if (tp !== type) {
      setType(tp);
      setRows(buildRows(tp));
      setGoals({});
    }
    go("basics");
  };

  const chooseExisting = async (name: string) => {
    setExistingName(name);
    const c = existingCampaigns.find((x) => x.name === name);
    setStartDay(storedDateToDay(c?.startDate) ?? "");
    setEndDay(storedDateToDay(c?.endDate) ?? "");
    setOwnerId(c?.owner?.id ?? null);
    if (!displayName.trim()) setDisplayName(name);
    // Prefill per-channel goals from the campaign record.
    if (name) {
      const res = await fetch(`/api/utm-campaigns/${encodeURIComponent(name)}`).catch(() => null);
      const d = res?.ok ? await res.json() : null;
      const g = parseGoalByMedium(d?.campaignRecord?.goalByMedium);
      setGoals(g ? Object.fromEntries(Object.entries(g).map(([m, n]) => [m, String(n)])) : {});
    }
  };

  const updateRow = (id: string, patch: Partial<PlanRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addAnother = (r: PlanRow) =>
    setRows((rs) => {
      const n = Math.max(...rs.filter((x) => x.channel.key === r.channel.key).map((x) => x.n)) + 1;
      const copy: PlanRow = { ...r, id: `${r.channel.key}-${n}`, n, include: true, title: null, content: null, code: null };
      const last = rs.map((x) => x.channel.key).lastIndexOf(r.channel.key);
      return [...rs.slice(0, last + 1), copy, ...rs.slice(last + 1)];
    });

  const create = async () => {
    if (!canCreate) return;
    setCreating(true);
    setCreateError(null);
    const batch = planRows;
    try {
      const csv = Papa.unparse(
        batch.map((r) => ({
          original_url: rowUrl(r),
          title: rowTitle(r),
          custom_code: rowCode(r),
          utm_source: r.channel.source,
          utm_medium: r.channel.medium,
          utm_campaign: campaign,
          utm_content: rowContent(r),
          tags: rowTags(r).join(","),
          redirect_type: "TEMPORARY",
        })),
      );
      const fd = new FormData();
      fd.append("file", new Blob([csv], { type: "text/csv" }), `${campaign}.csv`);
      const res = await fetch("/api/links/batch-csv", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : `HTTP ${res.status}`);
      const byRow = new Map<number, { ok: boolean; code?: string; error?: string }>(
        (data.results ?? []).map((x: { row: number; ok: boolean; code?: string; error?: string }) => [x.row, x]),
      );
      const out: CreateResult[] = batch.map((r, i) => {
        const x = byRow.get(i + 2); // row 1 is the header
        return x ? { rowId: r.id, ok: x.ok, code: x.code, error: x.error } : { rowId: r.id, ok: false, error: "No result" };
      });
      setResults((prev) => [...(prev ?? []).filter((p) => p.ok), ...out]);

      // Campaign settings — only what was answered, so an existing
      // campaign's goal isn't wiped by an empty goal step.
      // New campaign: only channels in this plan. Existing campaign: keep
      // the goals it already had for channels not touched here.
      const goalByMedium = Object.fromEntries(
        Object.entries(goals)
          .filter(([m]) => mode === "existing" || mediums.includes(m))
          .map(([m, v]) => [m, parseInt(v, 10)] as const)
          .filter(([, n]) => Number.isInteger(n) && n > 0),
      );
      const patch: Record<string, unknown> = {};
      if (startDay) patch.startDate = startDay;
      if (endDay) patch.endDate = endDay;
      if (effectiveOwner) patch.ownerId = effectiveOwner;
      if (Object.keys(goalByMedium).length > 0) patch.goalByMedium = goalByMedium;
      if (out.some((x) => x.ok) && Object.keys(patch).length > 0) {
        const pr = await fetch(`/api/utm-campaigns/${encodeURIComponent(campaign)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!pr.ok) setCreateError(t("settingsSaveFailed"));
      }

      for (const key of ["links", "campaign-links", "campaigns-summary", "analytics-raw", "utm-campaigns", "campaign-goal", "links-trash"]) {
        qc.invalidateQueries({ queryKey: [key], refetchType: "all" });
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  // ================= render =================
  const created = (results ?? []).filter((r) => r.ok);
  const failed = (results ?? []).filter((r) => !r.ok);
  const done = results !== null && created.length > 0 && failed.length === 0;
  const rowById = (id: string) => rows.find((r) => r.id === id);

  if (done) {
    return (
      <div className="ks-shell">
        <div className="ks-done">
          <CheckCircle2 size={40} style={{ color: "var(--ok-fg)" }} />
          <h1>{t("doneTitle", { n: created.length })}</h1>
          <p className="muted">{t("doneSub", { campaign })}</p>
          {createError && (
            <p className="ks-warn">
              <AlertTriangle size={14} /> {createError}
            </p>
          )}
        </div>

        <div className="ks-card">
          <div className="row-between" style={{ marginBottom: 8 }}>
            <strong>{t("doneLinks")}</strong>
            <button
              className="btn btn-secondary"
              onClick={() => copy(created.map((c) => `${shortBase}/${c.code}`).join("\n"), "all")}
            >
              {copied === "all" ? <Check size={13} /> : <Copy size={13} />} {t("copyAll")}
            </button>
          </div>
          <ul className="ks-created">
            {created.map((c) => {
              const r = rowById(c.rowId);
              const url = `${shortBase}/${c.code}`;
              return (
                <li key={c.rowId}>
                  <span className="ks-created-title">{r ? rowTitle(r) : c.code}</span>
                  <span className="ks-created-url">{url}</span>
                  <button className="btn btn-ghost" style={{ padding: 4 }} onClick={() => copy(url, c.rowId)} aria-label={tCommon("copy")}>
                    {copied === c.rowId ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="ks-card">
          <strong>{t("nextTitle")}</strong>
          <ol className="ks-next">
            <li>{t("next1")}</li>
            <li>{t("next2")}</li>
            <li>{t("next3")}</li>
          </ol>
        </div>

        <div className="ks-actions">
          <Link href={`/campaigns/${encodeURIComponent(campaign)}`} className="btn btn-primary">
            {t("goToCampaign")} <ArrowRight size={13} />
          </Link>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setResults(null);
              setType(null);
              setRows([]);
              setDisplayName("");
              setCampaignOverride(null);
              setExistingName("");
              setMode("new");
              setStartDay("");
              setEndDay("");
              setOwnerId(null);
              setLandingUrl("");
              setPagePending(false);
              setGoals({});
              go("type");
            }}
          >
            {t("startOver")}
          </button>
        </div>
      </div>
    );
  }

  const tpl = type ? TEMPLATES[type] : null;

  return (
    <div className={`ks-shell ${step === "review" ? "ks-wide" : ""}`}>
      {/* Progress */}
      <div className="ks-head">
        <Link href="/campaigns" className="ks-back">
          <ArrowLeft size={13} /> {t("backToCampaigns")}
        </Link>
        <div className="ks-title">
          <Rocket size={16} /> {t("title")}
        </div>
        <ol className="ks-progress" aria-label={t("progressLabel")}>
          {STEPS.map((s, i) => (
            <li key={s} className={i < stepIdx ? "done" : i === stepIdx ? "current" : ""}>
              <button
                type="button"
                disabled={i > stepIdx}
                onClick={() => i < stepIdx && go(s)}
                aria-current={i === stepIdx ? "step" : undefined}
              >
                <span className="ks-dot">{i < stepIdx ? <Check size={11} /> : i + 1}</span>
                <span className="ks-step-label">{t(`step.${s}`)}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="ks-step-count">{t("stepCount", { n: stepIdx + 1, total: STEPS.length })}</div>
      </div>

      {/* ---------- Step: type ---------- */}
      {step === "type" && (
        <section className="ks-step">
          <h1>{t("q.type")}</h1>
          <p className="ks-sub">{t("q.typeSub")}</p>
          <div className="ks-type-grid">
            {(["exhibition", "launch"] as CampaignType[]).map((tp) => (
              <button
                key={tp}
                type="button"
                className={`ks-type ${type === tp ? "active" : ""}`}
                onClick={() => chooseType(tp)}
              >
                {tp === "exhibition" ? <Presentation size={22} /> : <Megaphone size={22} />}
                <strong>{t(`type.${tp}`)}</strong>
                <span>{t(`type.${tp}Desc`)}</span>
                <span className="ks-type-eg">{t(`type.${tp}Eg`)}</span>
              </button>
            ))}
            <div className="ks-type ks-type-soon" aria-disabled>
              <Rocket size={22} />
              <strong>{t("type.ecommerce")}</strong>
              <span>{t("type.ecommerceSoon")}</span>
            </div>
          </div>
        </section>
      )}

      {/* ---------- Step: basics ---------- */}
      {step === "basics" && (
        <section className="ks-step">
          <h1>{t("q.basics")}</h1>
          <p className="ks-sub">{t("q.basicsSub")}</p>

          <div className="segmented" style={{ marginBottom: 16 }}>
            <button className={mode === "new" ? "active" : ""} onClick={() => setMode("new")}>
              {t("modeNew")}
            </button>
            <button
              className={mode === "existing" ? "active" : ""}
              onClick={() => setMode("existing")}
              disabled={existingCampaigns.length === 0}
            >
              {t("modeExisting")}
            </button>
          </div>

          {mode === "new" ? (
            <div className="ks-field">
              <label htmlFor="ks-name">{t("nameLabel")}</label>
              <input
                id="ks-name"
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t(type === "launch" ? "namePlaceholderLaunch" : "namePlaceholderExhibition")}
                autoFocus
              />
              <div className="ks-derived">
                {t("campaignLabel")}{" "}
                {campaignOverride === null ? (
                  <>
                    <code>{campaign || "—"}</code>{" "}
                    <button type="button" className="ks-link" onClick={() => setCampaignOverride(campaign)}>
                      {t("edit")}
                    </button>
                  </>
                ) : (
                  <input
                    className="input"
                    style={{ height: 28, maxWidth: 280, fontFamily: "var(--font-mono)" }}
                    value={campaignOverride}
                    onChange={(e) => setCampaignOverride(cleanCampaign(e.target.value))}
                    aria-label={t("campaignLabel")}
                  />
                )}
              </div>
              <p className="ks-hint">{t("campaignHint")}</p>
              {nameTaken && (
                <p className="ks-warn">
                  <AlertTriangle size={14} /> {t("nameTaken")}{" "}
                  <button
                    type="button"
                    className="ks-link"
                    onClick={() => {
                      setMode("existing");
                      chooseExisting(campaign);
                    }}
                  >
                    {t("switchToExisting")}
                  </button>
                </p>
              )}
            </div>
          ) : (
            <div className="ks-field">
              <label htmlFor="ks-existing">{t("existingLabel")}</label>
              <select
                id="ks-existing"
                className="input"
                value={existingName}
                onChange={(e) => chooseExisting(e.target.value)}
              >
                <option value="">{t("existingPick")}</option>
                {existingCampaigns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="ks-hint">{t("existingHint")}</p>
            </div>
          )}

          <div className="ks-field-row">
            <div className="ks-field">
              <label htmlFor="ks-start">{t("startLabel")}</label>
              <input id="ks-start" type="date" className="input" value={startDay} max={endDay || undefined} onChange={(e) => setStartDay(e.target.value)} />
            </div>
            <div className="ks-field">
              <label htmlFor="ks-end">{t("endLabel")}</label>
              <input id="ks-end" type="date" className="input" value={endDay} min={startDay || undefined} onChange={(e) => setEndDay(e.target.value)} />
            </div>
          </div>
          <p className="ks-hint">{t(type === "exhibition" ? "periodHintExhibition" : "periodHintLaunch")}</p>
          {startDay && startDay < todayDay() && mode === "new" && (
            <p className="ks-warn">
              <AlertTriangle size={14} /> {t("startInPast")}
            </p>
          )}
          {!datesOk && (
            <p className="ks-warn">
              <AlertTriangle size={14} /> {t("endBeforeStart")}
            </p>
          )}

          <div className="ks-field">
            <label htmlFor="ks-owner">{t("ownerLabel")}</label>
            <select id="ks-owner" className="input" value={effectiveOwner} onChange={(e) => setOwnerId(e.target.value)}>
              {(members ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {ownerLabel(m)}
                  {m.id === myId ? ` ${t("me")}` : ""}
                </option>
              ))}
            </select>
            <p className="ks-hint">{t("ownerHint")}</p>
          </div>
        </section>
      )}

      {/* ---------- Step: destination ---------- */}
      {step === "destination" && (
        <section className="ks-step">
          <h1>{t("q.destination")}</h1>
          <p className="ks-sub">{t(type === "exhibition" ? "q.destinationSubExhibition" : "q.destinationSubLaunch")}</p>
          <div className="ks-field">
            <label htmlFor="ks-url">{t("landingLabel")}</label>
            <input
              id="ks-url"
              className="input"
              type="url"
              value={landingUrl}
              onChange={(e) => setLandingUrl(e.target.value)}
              placeholder="https://www.engeniustech.com/…"
              autoFocus
            />
            {landingUrl.trim() && !urlOk(landingUrl) && <p className="ks-warn">{t("urlInvalid")}</p>}
          </div>
          <label className="ks-check">
            <input type="checkbox" checked={pagePending} onChange={(e) => setPagePending(e.target.checked)} />
            <span>
              <strong>{t("pagePending")}</strong>
              <span className="ks-hint" style={{ display: "block" }}>
                {t("pagePendingHint")}
              </span>
            </span>
          </label>
        </section>
      )}

      {/* ---------- Step: channels ---------- */}
      {step === "channels" && tpl && (
        <section className="ks-step">
          <h1>{t("q.channels")}</h1>
          <p className="ks-sub">{t("q.channelsSub")}</p>
          {tpl.phases.map((ph: Phase) => {
            const phRows = rows.filter((r) => r.channel.phase === ph);
            if (phRows.length === 0) return null;
            return (
              <div key={ph} className="ks-phase">
                <div className="ks-phase-head">
                  <strong>{t(`phase.${ph}`)}</strong>
                  <span className="muted">{t(`phaseHint.${ph}`)}</span>
                </div>
                {phRows.map((r) => {
                  const existing = rowExisting(r);
                  return (
                    <div key={r.id} className={`ks-row ${r.include && !existing ? "on" : ""}`}>
                      <label className="ks-row-main">
                        <input
                          type="checkbox"
                          checked={r.include && !existing}
                          disabled={Boolean(existing)}
                          onChange={(e) => updateRow(r.id, { include: e.target.checked })}
                        />
                        <span className="ks-row-label">
                          {t(`channels.${r.channel.key}`)}
                          {r.n > 1 && ` #${r.n}`}
                        </span>
                        <span className="pill pill-medium">{r.channel.medium}</span>
                        <span className="pill pill-source">{r.channel.source}</span>
                        {existing && <span className="ks-existing">{t("alreadyCreated", { code: existing })}</span>}
                      </label>
                      {!existing && (
                        <div className="ks-row-tools">
                          {r.n > 1 ? (
                            <button className="btn btn-ghost" style={{ padding: 4 }} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} aria-label={tCommon("remove")}>
                              <X size={13} />
                            </button>
                          ) : (
                            r.include && (
                              <button className="ks-link" onClick={() => addAnother(r)}>
                                <Plus size={12} /> {t("addAnother")}
                              </button>
                            )
                          )}
                        </div>
                      )}
                      {r.include && !existing && r.channel.ownUrl && (
                        <div className="ks-row-url">
                          <span className="muted">{t("qrGoesTo")}</span>
                          <input
                            className="input"
                            type="url"
                            value={r.url}
                            onChange={(e) => updateRow(r.id, { url: e.target.value })}
                            placeholder={landingUrl || "https://"}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          <p className="ks-total">{t("willCreate", { n: planRows.length })}</p>
        </section>
      )}

      {/* ---------- Step: goals ---------- */}
      {step === "goals" && (
        <section className="ks-step">
          <h1>{t("q.goals")}</h1>
          <p className="ks-sub">{t("q.goalsSub")}</p>
          <div className="ks-goals">
            {mediums.map((m) => {
              const sug = suggestedGoal(m);
              const n = planRows.filter((r) => r.channel.medium === m).length;
              return (
                <div key={m} className="ks-goal">
                  <span className="pill pill-medium">{m}</span>
                  <span className="muted ks-goal-n">{t("goalPieces", { n })}</span>
                  <input
                    type="number"
                    min={1}
                    className="input"
                    value={goals[m] ?? ""}
                    onChange={(e) => setGoals((g) => ({ ...g, [m]: e.target.value }))}
                    placeholder={sug ? String(sug) : ""}
                    aria-label={m}
                  />
                  <span className="ks-hint ks-goal-ref">
                    {perLinkAvg[m]
                      ? t("goalRef", { avg: perLinkAvg[m], n, sug: sug ?? 0 })
                      : rawLoading
                        ? t("goalRefLoading")
                        : t("goalNoRef")}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="row" style={{ gap: 12, marginTop: 8, flexWrap: "wrap" }}>
            <button
              className="btn btn-secondary"
              disabled={!mediums.some((m) => suggestedGoal(m))}
              onClick={() =>
                setGoals((g) => {
                  const next = { ...g };
                  for (const m of mediums) {
                    const s = suggestedGoal(m);
                    if (s) next[m] = String(s);
                  }
                  return next;
                })
              }
            >
              {t("useSuggestions")}
            </button>
            <span className="ks-hint">
              {t("goalTotal", {
                n: mediums.reduce((s, m) => s + (parseInt(goals[m] ?? "", 10) || 0), 0).toLocaleString(),
              })}
            </span>
          </div>
          <p className="ks-hint" style={{ marginTop: 12 }}>
            {startDay && endDay ? t("goalPaceNote") : t("goalSkipNote")}
          </p>
        </section>
      )}

      {/* ---------- Step: review ---------- */}
      {step === "review" && (
        <section className="ks-step">
          <h1>{t("q.review")}</h1>
          <p className="ks-sub">{t("q.reviewSub")}</p>

          <dl className="ks-summary">
            <div>
              <dt>{t("campaignLabel")}</dt>
              <dd>
                <code>{campaign}</code>
                {mode === "existing" && <span className="muted"> · {t("modeExisting")}</span>}
              </dd>
            </div>
            <div>
              <dt>{t("periodLabel")}</dt>
              <dd>{startDay || endDay ? `${startDay || "…"} – ${endDay || "…"}` : t("notSet")}</dd>
            </div>
            <div>
              <dt>{t("ownerLabel")}</dt>
              <dd>{ownerLabel(members?.find((m) => m.id === effectiveOwner) ?? { id: "", name: null, image: null })}</dd>
            </div>
            <div>
              <dt>{t("goalLabel")}</dt>
              <dd>
                {mediums.filter((m) => parseInt(goals[m] ?? "", 10) > 0).length > 0
                  ? mediums
                      .filter((m) => parseInt(goals[m] ?? "", 10) > 0)
                      .map((m) => `${m} ${parseInt(goals[m], 10).toLocaleString()}`)
                      .join(" · ")
                  : t("notSet")}
              </dd>
            </div>
          </dl>

          <div className="table-scroll ks-review-table">
            <table className="data" style={{ tableLayout: "fixed", minWidth: 980 }}>
              <thead>
                <tr>
                  <th style={{ width: "26%" }}>{t("colTitle")}</th>
                  <th style={{ width: 150 }}>{t("colChannel")}</th>
                  <th style={{ width: 150 }}>utm_content</th>
                  <th style={{ width: 190 }}>{t("colCode")}</th>
                  <th>{t("colUrl")}</th>
                </tr>
              </thead>
              <tbody>
                {planRows.map((r) => {
                  const problem = rowCodeProblem(r);
                  const code = rowCode(r);
                  return (
                    <tr key={r.id}>
                      <td>
                        <input className="input ks-cell" value={r.title ?? rowTitle(r)} onChange={(e) => updateRow(r.id, { title: e.target.value })} aria-label={t("colTitle")} />
                        <div className="ks-tags">
                          {rowTags(r).map((tg) => (
                            <span key={tg} className="pill pill-content">
                              {tg}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className="pill pill-medium">{r.channel.medium}</span>{" "}
                        <span className="pill pill-source">{r.channel.source}</span>
                      </td>
                      <td>
                        <input
                          className="input ks-cell"
                          style={{ fontFamily: "var(--font-mono)" }}
                          value={r.content ?? rowContent(r)}
                          onChange={(e) => updateRow(r.id, { content: cleanCampaign(e.target.value) })}
                          aria-label="utm_content"
                        />
                      </td>
                      <td>
                        <input
                          className={`input ks-cell ${problem ? "ks-cell-bad" : ""}`}
                          style={{ fontFamily: "var(--font-mono)" }}
                          value={code}
                          onChange={(e) => updateRow(r.id, { code: cleanCode(e.target.value) })}
                          placeholder={t("codeRandom")}
                          aria-label={t("colCode")}
                        />
                        <div className={`ks-code-status ${problem ? "bad" : ""}`}>
                          {problem ?? (code ? (codeStatus?.[code] ? `✓ ${t("codeOk")}` : "…") : t("codeRandomHint"))}
                        </div>
                      </td>
                      <td>
                        <input
                          className={`input ks-cell ${urlOk(rowUrl(r)) ? "" : "ks-cell-bad"}`}
                          value={r.url}
                          onChange={(e) => updateRow(r.id, { url: e.target.value })}
                          placeholder={landingUrl}
                          aria-label={t("colUrl")}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(() => {
            const bad = planRows.filter((r) => rowCodeProblem(r) || !urlOk(rowUrl(r))).length;
            return bad > 0 ? (
              <p className="ks-warn" style={{ marginTop: 12 }}>
                <AlertTriangle size={14} /> {t("rowsNeedFix", { n: bad })}
              </p>
            ) : null;
          })()}
          {failed.length > 0 && (
            <div className="ks-warn-box">
              <strong>
                <AlertTriangle size={14} /> {t("someFailed", { n: failed.length, ok: created.length })}
              </strong>
              <ul>
                {failed.map((f) => (
                  <li key={f.rowId}>
                    {rowById(f.rowId) ? rowTitle(rowById(f.rowId)!) : f.rowId}：{f.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {createError && (
            <p className="ks-warn">
              <AlertTriangle size={14} /> {createError}
            </p>
          )}
        </section>
      )}

      {/* Footer nav */}
      <div className="ks-nav">
        {stepIdx > 0 ? (
          <button className="btn btn-secondary" onClick={() => go(STEPS[stepIdx - 1])} disabled={creating}>
            <ArrowLeft size={13} /> {t("back")}
          </button>
        ) : (
          <span />
        )}
        {step === "review" ? (
          <button className="btn btn-primary" onClick={create} disabled={!canCreate}>
            {creating ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}{" "}
            {failed.length > 0 ? t("retryFailed", { n: planRows.length }) : t("createN", { n: planRows.length })}
          </button>
        ) : step !== "type" ? (
          <button className="btn btn-primary" onClick={() => go(STEPS[stepIdx + 1])} disabled={!canNext[step]}>
            {step === "goals" && mediums.every((m) => !goals[m]) ? t("skip") : t("next")} <ArrowRight size={13} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
