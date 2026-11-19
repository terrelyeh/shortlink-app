"use client";

/**
 * Campaign Kickstart — a guided, one-question-per-screen version of the
 * campaign-link-planner skill: type → basics → destination → channels →
 * goals → review → create. Naming (utm_*, short codes, titles, tags) is
 * generated from lib/kickstart, so marketers never type UTM values.
 *
 * Creation goes through the CSV import endpoint (/api/links/batch-csv) in
 * one request — it already handles tags by name, custom codes and the UTM
 * whitelist per row — then the campaign's name / period / owner / goals
 * are set with PATCH /api/utm-campaigns/[name].
 *
 * Partial failures: created rows drop out of the plan, the rest stay for
 * a retry, and the campaign identity (name / mode) is locked once anything
 * was created so a retry can't land under a different utm_campaign.
 */

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { useTranslations } from "next-intl";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Link } from "@/i18n/routing";
import {
  AlertTriangle,
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
} from "lucide-react";
import {
  PAGE_PENDING_TAG,
  PHASE_TAGS,
  TEMPLATES,
  type CampaignType,
  type Phase,
  type TemplateChannel,
} from "@/lib/kickstart/templates";
import {
  CODE_RE,
  cleanCampaign,
  cleanCode,
  codePrefix,
  looseCampaign,
  looseCode,
  suggestCampaign,
} from "@/lib/kickstart/naming";
import { storedDateToDay } from "@/lib/campaign-period";
import { parseGoalByMedium } from "@/lib/campaign-goal";
import { invalidateAfterLinksCreated } from "@/lib/query/invalidate-links";
import { ownerLabel, useWorkspaceMembers, type OwnerInfo } from "@/components/campaigns/CampaignOwner";
import type { RawAnalyticsData } from "@/lib/analytics/compute";

type StepId = "type" | "basics" | "destination" | "channels" | "goals" | "review";
const STEPS: StepId[] = ["type", "basics", "destination", "channels", "goals", "review"];
/** Owner select value meaning "the signed-in user" (new campaigns). */
const ME = "__me__";

interface PlanRow {
  id: string;
  channel: TemplateChannel;
  /** 1 for the template row, 2+ for "add another" copies. */
  n: number;
  include: boolean;
  /** Overrides as typed (loose); null = use the generated value. */
  title: string | null;
  content: string | null;
  code: string | null;
  url: string;
}

interface SummaryCampaign {
  id: string | null;
  name: string;
  displayName: string | null;
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

const urlOk = (u: string) => /^https?:\/\/\S+\.\S+/i.test(u.trim());

export function KickstartWizard() {
  const t = useTranslations("kickstart");
  const tCommon = useTranslations("common");
  const qc = useQueryClient();
  const { data: session } = useSession();
  const myId = session?.user?.id ?? "";
  const { data: members } = useWorkspaceMembers();

  const [step, setStep] = useState<StepId>("type");
  const stepIdx = STEPS.indexOf(step);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rowSeq = useRef(0);
  const pickSeq = useRef(0);

  // --- answers ---
  const [type, setType] = useState<CampaignType | null>(null);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [displayName, setDisplayName] = useState("");
  const [campaignOverride, setCampaignOverride] = useState<string | null>(null);
  const [existingName, setExistingName] = useState("");
  const [startDay, setStartDay] = useState("");
  const [endDay, setEndDay] = useState("");
  const [ownerSel, setOwnerSel] = useState<string>(ME); // ME | user id | "" (unassigned)
  const [ownerInitial, setOwnerInitial] = useState<string>(ME);
  const [landingUrl, setLandingUrl] = useState("");
  const [pagePending, setPagePending] = useState(false);
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [goals, setGoals] = useState<Record<string, string>>({});
  /** Existing campaign's per-channel goals / total-only goal (to preserve). */
  const [initialGoals, setInitialGoals] = useState<Record<string, number>>({});
  const [totalOnlyGoal, setTotalOnlyGoal] = useState<number | null>(null);
  const [prefixOverride, setPrefixOverride] = useState<string | null>(null);

  // --- create ---
  const [creating, setCreating] = useState(false);
  const [results, setResults] = useState<CreateResult[] | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const created = (results ?? []).filter((r) => r.ok);
  const failed = (results ?? []).filter((r) => !r.ok);
  /** Once anything is created the campaign identity can't change. */
  const locked = created.length > 0;

  // Existing campaigns: the summary (has period / owner / display name) plus
  // the plain campaign list (also has campaigns without links). Same keys /
  // URLs as the campaign list and the UTM builder.
  const { data: summary } = useQuery<{ campaigns: SummaryCampaign[] }>({
    queryKey: ["campaigns-summary", "period"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/campaigns-summary?days=730");
      if (!res.ok) throw new Error("Failed to fetch campaigns summary");
      return res.json();
    },
  });
  const { data: campaignList } = useQuery<{ campaigns: { name: string; displayName: string | null }[] }>({
    queryKey: ["utm-campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/campaigns");
      if (!res.ok) return { campaigns: [] };
      return res.json();
    },
  });
  const existingCampaigns = useMemo(() => {
    const m = new Map<string, SummaryCampaign>();
    for (const c of summary?.campaigns ?? []) if (c.id) m.set(c.name, c);
    for (const c of campaignList?.campaigns ?? []) {
      if (!m.has(c.name)) {
        m.set(c.name, { id: c.name, name: c.name, displayName: c.displayName, startDate: null, endDate: null, owner: null });
      }
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [summary, campaignList]);

  const campaign =
    mode === "existing"
      ? existingName
      : campaignOverride !== null
        ? cleanCampaign(campaignOverride)
        : type
          ? suggestCampaign(type, displayName, startDay || null)
          : "";
  const nameTaken = mode === "new" && !locked && existingCampaigns.some((c) => c.name === campaign);
  const prefix = prefixOverride !== null ? cleanCode(prefixOverride) : codePrefix(campaign || "c");
  const label = displayName.trim() || campaign;
  const ownerResolved = ownerSel === ME ? myId : ownerSel;

  // Links already in an existing campaign (skip their channel combos).
  // Same key / request / shape as the campaign page's Links tab.
  const { data: existingLinks } = useQuery<
    { id: string; code: string; utmSource: string | null; utmMedium: string | null; utmContent: string | null }[]
  >({
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
  const rowContent = (r: PlanRow) =>
    (r.content !== null ? cleanCampaign(r.content) : "") ||
    (r.n > 1 ? `${r.channel.content}_${r.n}` : r.channel.content);
  const rowCode = (r: PlanRow) =>
    r.code !== null ? cleanCode(r.code) : `${prefix}-${r.channel.code}${r.n > 1 ? `-${r.n}` : ""}`;
  const rowTitle = (r: PlanRow) =>
    r.title?.trim() || `${label}｜${t(`channels.${r.channel.key}`)}${r.n > 1 ? ` #${r.n}` : ""}`;
  const rowUrl = (r: PlanRow) => r.url.trim() || landingUrl.trim();
  const rowExisting = (r: PlanRow) => existingCombo.get(`${r.channel.source}|${r.channel.medium}|${rowContent(r)}`);
  const rowTags = (r: PlanRow) => {
    const tags: string[] = [];
    const ph = PHASE_TAGS[r.channel.phase];
    if (ph) tags.push(ph);
    if (pagePending && !r.url.trim()) tags.push(PAGE_PENDING_TAG);
    return tags;
  };

  /** Ticked rows this run is about (incl. ones already created this session). */
  const chosenRows = rows.filter((r) => r.include && !rowExisting(r));
  /** Rows still to create. */
  const planRows = chosenRows.filter((r) => !created.some((x) => x.rowId === r.id));
  /** Goal channels follow everything chosen, so a retry can't shrink them. */
  const goalMediums = Array.from(new Set(chosenRows.map((r) => r.channel.medium)));

  // Reference for goals: average clicks per link, per medium, across the
  // workspace's other campaigns (real clicks — same payload as dashboards).
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
    const out: Record<string, { avg: number; links: number }> = {};
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
    for (const [m, s] of Object.entries(sum)) {
      if (s.links > 0 && s.clicks > 0) out[m] = { avg: Math.max(1, Math.round(s.clicks / s.links)), links: s.links };
    }
    return out;
  }, [raw, campaign]);
  const newPieces = (m: string) => chosenRows.filter((r) => r.channel.medium === m).length;
  const suggestedGoal = (m: string) => {
    const ref = perLinkAvg[m];
    if (!ref) return null;
    // Existing campaign: its current goal covers the links it already has.
    return (mode === "existing" ? (initialGoals[m] ?? 0) : 0) + ref.avg * newPieces(m);
  };

  // Short-code availability — one cached query per code, so typing in one
  // field doesn't re-check every row.
  const codes =
    step === "review" ? Array.from(new Set(planRows.map(rowCode).filter((c) => CODE_RE.test(c)))) : [];
  const codeQueries = useQueries({
    queries: codes.map((c) => ({
      queryKey: ["check-code", c],
      staleTime: 60_000,
      queryFn: async () => {
        const res = await fetch(`/api/links/check-code?code=${encodeURIComponent(c)}`);
        const d = await res.json().catch(() => ({}));
        return d.available !== false;
      },
    })),
  });
  const codeStatus: Record<string, boolean | undefined> = Object.fromEntries(
    codes.map((c, i) => [c, codeQueries[i]?.data as boolean | undefined]),
  );

  // --- validation ---
  const datesOk = !startDay || !endDay || startDay <= endDay;
  const nameNeedsLatin = mode === "new" && Boolean(displayName.trim()) && campaign.length < 3;
  const canNext: Record<StepId, boolean> = {
    type: Boolean(type),
    basics:
      campaign.length >= 3 &&
      !nameTaken &&
      datesOk &&
      (mode === "new" ? Boolean(displayName.trim()) : Boolean(existingName)),
    destination: urlOk(landingUrl),
    channels: planRows.length > 0 && planRows.every((r) => !r.url.trim() || urlOk(r.url)),
    goals: true,
    review: false,
  };
  const codeCounts = new Map<string, number>();
  const comboCounts = new Map<string, number>();
  for (const r of planRows) {
    const c = rowCode(r);
    if (c) codeCounts.set(c, (codeCounts.get(c) ?? 0) + 1);
    const k = `${r.channel.source}|${r.channel.medium}|${rowContent(r)}`;
    comboCounts.set(k, (comboCounts.get(k) ?? 0) + 1);
  }
  const rowContentProblem = (r: PlanRow): string | null => {
    const k = `${r.channel.source}|${r.channel.medium}|${rowContent(r)}`;
    if ((comboCounts.get(k) ?? 0) > 1) return t("contentDuplicate");
    if (existingCombo.has(k)) return t("contentExists");
    return null;
  };
  const rowCodeProblem = (r: PlanRow): string | null => {
    const c = rowCode(r);
    if (!c) return null; // random code
    if (!CODE_RE.test(c)) return t("codeInvalid");
    if ((codeCounts.get(c) ?? 0) > 1) return t("codeDuplicate");
    if (codeStatus[c] === false) return t("codeTaken");
    return null;
  };
  const codesPending = codes.some((c) => codeStatus[c] === undefined);
  const badRows = planRows.filter((r) => rowCodeProblem(r) || rowContentProblem(r) || !urlOk(rowUrl(r))).length;
  const canCreate = !creating && planRows.length > 0 && badRows === 0 && !codesPending;

  const go = (s: StepId) => {
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Move focus to the new question for keyboard / screen-reader users.
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
  };

  // --- handlers ---
  const chooseType = (tp: CampaignType) => {
    if (tp !== type) {
      setType(tp);
      setRows(
        TEMPLATES[tp].channels.map((c) => ({
          id: `${c.key}-${++rowSeq.current}`,
          channel: c,
          n: 1,
          include: c.on,
          title: null,
          content: null,
          code: null,
          url: "",
        })),
      );
    }
    go("basics");
  };

  const chooseExisting = async (name: string) => {
    const seq = ++pickSeq.current;
    setExistingName(name);
    const c = existingCampaigns.find((x) => x.name === name);
    setDisplayName(c ? c.displayName || c.name : "");
    setStartDay(storedDateToDay(c?.startDate) ?? "");
    setEndDay(storedDateToDay(c?.endDate) ?? "");
    const owner = c?.owner?.id ?? "";
    setOwnerSel(owner);
    setOwnerInitial(owner);
    setGoals({});
    setInitialGoals({});
    setTotalOnlyGoal(null);
    setPrefixOverride(null);
    if (!name) return;
    const res = await fetch(`/api/utm-campaigns/${encodeURIComponent(name)}`).catch(() => null);
    const d = res?.ok ? await res.json() : null;
    if (seq !== pickSeq.current) return; // a later pick won
    const g = parseGoalByMedium(d?.campaignRecord?.goalByMedium);
    if (g) {
      setInitialGoals(g);
      setGoals(Object.fromEntries(Object.entries(g).map(([m, n]) => [m, String(n)])));
    } else if (d?.goalClicks) {
      setTotalOnlyGoal(d.goalClicks);
    }
    if (d?.campaignRecord) {
      setStartDay(storedDateToDay(d.campaignRecord.startDate) ?? "");
      setEndDay(storedDateToDay(d.campaignRecord.endDate) ?? "");
      const o = d.campaignRecord.ownerId ?? "";
      setOwnerSel(o);
      setOwnerInitial(o);
    }
  };

  const updateRow = (id: string, patch: Partial<PlanRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addAnother = (r: PlanRow) =>
    setRows((rs) => {
      const n = Math.max(...rs.filter((x) => x.channel.key === r.channel.key).map((x) => x.n)) + 1;
      const copy: PlanRow = {
        ...r,
        id: `${r.channel.key}-${++rowSeq.current}`,
        n,
        include: true,
        title: null,
        content: null,
        code: null,
      };
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
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : t("errHttp", { status: res.status }));
      }
      const byRow = new Map<number, { ok: boolean; code?: string; error?: string }>(
        (data.results ?? []).map((x: { row: number; ok: boolean; code?: string; error?: string }) => [x.row, x]),
      );
      const out: CreateResult[] = batch.map((r, i) => {
        const x = byRow.get(i + 2); // row 1 is the header
        return x
          ? { rowId: r.id, ok: x.ok, code: x.code, error: x.error }
          : { rowId: r.id, ok: false, error: t("errNoResult") };
      });
      const allCreated = [...created, ...out.filter((x) => x.ok)];
      setResults([...created, ...out]);

      if (allCreated.length > 0) {
        // Campaign settings. New campaign: what was answered. Existing:
        // dates as shown (cleared = null), owner / goals only if changed,
        // so nothing the user didn't touch is overwritten.
        const goalByMedium = Object.fromEntries(
          Object.entries(goals)
            .filter(([m]) => mode === "existing" || goalMediums.includes(m))
            .map(([m, v]) => [m, parseInt(v, 10)] as const)
            .filter(([, n]) => Number.isInteger(n) && n > 0),
        );
        const goalsChanged =
          Object.keys(goalByMedium).length > 0 &&
          JSON.stringify(Object.entries(goalByMedium).sort()) !== JSON.stringify(Object.entries(initialGoals).sort());
        const patch: Record<string, unknown> = {};
        if (mode === "new") {
          if (displayName.trim()) patch.displayName = displayName.trim();
          if (startDay) patch.startDate = startDay;
          if (endDay) patch.endDate = endDay;
          if (ownerResolved) patch.ownerId = ownerResolved;
        } else {
          patch.startDate = startDay || null;
          patch.endDate = endDay || null;
          if (ownerSel !== ownerInitial) patch.ownerId = ownerResolved || null;
        }
        if (goalsChanged) patch.goalByMedium = goalByMedium;
        const pr = await fetch(`/api/utm-campaigns/${encodeURIComponent(campaign)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        setSettingsSaved(pr.ok);
        if (!pr.ok) setCreateError(t("settingsSaveFailed"));
      }

      invalidateAfterLinksCreated(qc);
      qc.invalidateQueries({ queryKey: ["campaign-goal"], refetchType: "all" });
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

  const startOver = () => {
    setResults(null);
    setCreateError(null);
    setSettingsSaved(false);
    setType(null);
    setRows([]);
    setDisplayName("");
    setCampaignOverride(null);
    setExistingName("");
    setMode("new");
    setStartDay("");
    setEndDay("");
    setOwnerSel(ME);
    setOwnerInitial(ME);
    setLandingUrl("");
    setPagePending(false);
    setGoals({});
    setInitialGoals({});
    setTotalOnlyGoal(null);
    setPrefixOverride(null);
    go("type");
  };

  const rowById = (id: string) => rows.find((r) => r.id === id);

  // ================= done =================
  if (results !== null && created.length > 0 && failed.length === 0) {
    return (
      <div className="ks-shell">
        <div className="ks-done">
          <CheckCircle2 size={40} style={{ color: "var(--ok-fg)" }} />
          <h1 ref={headingRef} tabIndex={-1}>
            {t("doneTitle", { n: created.length })}
          </h1>
          <p className="muted">
            {settingsSaved ? t("doneSub", { campaign }) : t("doneSubLinksOnly", { campaign })}
          </p>
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
                  <button
                    className="btn btn-ghost"
                    style={{ padding: 4 }}
                    onClick={() => copy(url, c.rowId)}
                    aria-label={`${tCommon("copy")} ${url}`}
                  >
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
          <button className="btn btn-secondary" onClick={startOver}>
            {t("startOver")}
          </button>
        </div>
      </div>
    );
  }

  const tpl = type ? TEMPLATES[type] : null;
  const ownerOptions = (members ?? []).map((m) => (
    <option key={m.id} value={mode === "new" && m.id === myId ? ME : m.id}>
      {ownerLabel(m)}
      {m.id === myId ? ` ${t("me")}` : ""}
    </option>
  ));

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
                disabled={i > stepIdx || creating}
                onClick={() => i < stepIdx && go(s)}
                aria-current={i === stepIdx ? "step" : undefined}
                aria-label={`${i + 1}. ${t(`step.${s}`)}`}
              >
                <span className="ks-dot" aria-hidden>
                  {i < stepIdx ? <Check size={11} /> : i + 1}
                </span>
                <span className="ks-step-label" aria-hidden>
                  {t(`step.${s}`)}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <div className="ks-step-count">{t("stepCount", { n: stepIdx + 1, total: STEPS.length })}</div>
      </div>

      {/* ---------- Step: type ---------- */}
      {step === "type" && (
        <section className="ks-step">
          <h1 ref={headingRef} tabIndex={-1}>
            {t("q.type")}
          </h1>
          <p className="ks-sub">{t("q.typeSub")}</p>
          <div className="ks-type-grid">
            {(["exhibition", "launch"] as CampaignType[]).map((tp) => (
              <button
                key={tp}
                type="button"
                className={`ks-type ${type === tp ? "active" : ""}`}
                onClick={() => chooseType(tp)}
                disabled={locked && tp !== type}
                aria-pressed={type === tp}
              >
                {tp === "exhibition" ? <Presentation size={22} /> : <Megaphone size={22} />}
                <strong>{t(`type.${tp}`)}</strong>
                <span>{t(`type.${tp}Desc`)}</span>
                <span className="ks-type-eg">{t(`type.${tp}Eg`)}</span>
              </button>
            ))}
            <button type="button" className="ks-type ks-type-soon" disabled>
              <Rocket size={22} />
              <strong>{t("type.ecommerce")}</strong>
              <span>{t("type.ecommerceSoon")}</span>
            </button>
          </div>
        </section>
      )}

      {/* ---------- Step: basics ---------- */}
      {step === "basics" && (
        <section className="ks-step">
          <h1 ref={headingRef} tabIndex={-1}>
            {t("q.basics")}
          </h1>
          <p className="ks-sub">{t("q.basicsSub")}</p>
          {locked && (
            <p className="ks-warn" style={{ marginBottom: 12 }}>
              <AlertTriangle size={14} /> {t("lockedAfterCreate")}
            </p>
          )}

          <div className="segmented" style={{ marginBottom: 16 }}>
            <button
              className={mode === "new" ? "active" : ""}
              onClick={() => {
                setMode("new");
                setOwnerSel(ME);
                setOwnerInitial(ME);
              }}
              disabled={locked}
            >
              {t("modeNew")}
            </button>
            <button
              className={mode === "existing" ? "active" : ""}
              onClick={() => setMode("existing")}
              disabled={locked || existingCampaigns.length === 0}
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
                disabled={locked}
              />
              <div className="ks-derived">
                {t("campaignLabel")}{" "}
                {campaignOverride === null ? (
                  <>
                    <code>{campaign || "—"}</code>{" "}
                    {!locked && (
                      <button type="button" className="ks-link" onClick={() => setCampaignOverride(campaign)}>
                        {t("edit")}
                      </button>
                    )}
                  </>
                ) : (
                  <input
                    className="input"
                    style={{ height: 28, maxWidth: 280, fontFamily: "var(--font-mono)" }}
                    value={campaignOverride}
                    onChange={(e) => setCampaignOverride(looseCampaign(e.target.value))}
                    aria-label={t("campaignLabel")}
                    disabled={locked}
                  />
                )}
              </div>
              <p className="ks-hint">{t("campaignHint")}</p>
              {nameNeedsLatin && (
                <p className="ks-warn">
                  <AlertTriangle size={14} /> {t("nameNeedsLatin")}
                </p>
              )}
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
                disabled={locked}
              >
                <option value="">{t("existingPick")}</option>
                {existingCampaigns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.displayName && c.displayName !== c.name ? `${c.displayName}（${c.name}）` : c.name}
                  </option>
                ))}
              </select>
              <p className="ks-hint">{t("existingHint")}</p>
            </div>
          )}

          <div className="ks-field-row">
            <div className="ks-field">
              <label htmlFor="ks-start">{t("startLabel")}</label>
              <input
                id="ks-start"
                type="date"
                className="input"
                value={startDay}
                max={endDay || undefined}
                onChange={(e) => setStartDay(e.target.value)}
              />
            </div>
            <div className="ks-field">
              <label htmlFor="ks-end">{t("endLabel")}</label>
              <input
                id="ks-end"
                type="date"
                className="input"
                value={endDay}
                min={startDay || undefined}
                onChange={(e) => setEndDay(e.target.value)}
              />
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

          <div className="ks-field" style={{ marginTop: 18 }}>
            <label htmlFor="ks-owner">{t("ownerLabel")}</label>
            <select id="ks-owner" className="input" value={ownerSel} onChange={(e) => setOwnerSel(e.target.value)}>
              <option value="">{t("ownerUnassigned")}</option>
              {ownerOptions}
            </select>
            <p className="ks-hint">{t("ownerHint")}</p>
          </div>
        </section>
      )}

      {/* ---------- Step: destination ---------- */}
      {step === "destination" && (
        <section className="ks-step">
          <h1 ref={headingRef} tabIndex={-1}>
            {t("q.destination")}
          </h1>
          <p className="ks-sub">
            {t(type === "exhibition" ? "q.destinationSubExhibition" : "q.destinationSubLaunch")}
          </p>
          <div className="ks-field">
            <label htmlFor="ks-url">{t("landingLabel")}</label>
            <input
              id="ks-url"
              className="input"
              type="url"
              value={landingUrl}
              onChange={(e) => setLandingUrl(e.target.value)}
              placeholder="https://www.engeniustech.com/…"
            />
            {landingUrl.trim() && !urlOk(landingUrl) && <p className="ks-warn">{t("urlInvalid")}</p>}
          </div>
          <label className="ks-check">
            <input type="checkbox" checked={pagePending} onChange={(e) => setPagePending(e.target.checked)} />
            <span>
              <strong>{t("pagePending")}</strong>
              <span className="ks-hint" style={{ display: "block" }}>
                {t("pagePendingHint", { tag: PAGE_PENDING_TAG })}
              </span>
            </span>
          </label>
        </section>
      )}

      {/* ---------- Step: channels ---------- */}
      {step === "channels" && tpl && (
        <section className="ks-step">
          <h1 ref={headingRef} tabIndex={-1}>
            {t("q.channels")}
          </h1>
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
                  const done = created.some((x) => x.rowId === r.id);
                  const active = r.include && !existing && !done;
                  return (
                    <div key={r.id} className={`ks-row ${active ? "on" : ""}`}>
                      <label className="ks-row-main">
                        <input
                          type="checkbox"
                          checked={r.include && !existing}
                          disabled={Boolean(existing) || done}
                          onChange={(e) => updateRow(r.id, { include: e.target.checked })}
                        />
                        <span className="ks-row-label">
                          {t(`channels.${r.channel.key}`)}
                          {r.n > 1 && ` #${r.n}`}
                        </span>
                        <span className="pill pill-medium">{r.channel.medium}</span>
                        <span className="pill pill-source">{r.channel.source}</span>
                        {existing && <span className="ks-existing">{t("alreadyCreated", { code: existing })}</span>}
                        {done && <span className="ks-existing">{t("createdThisRun")}</span>}
                      </label>
                      <div className="ks-row-tools">
                        {r.n > 1 && !done ? (
                          <button
                            className="btn btn-ghost"
                            style={{ padding: 4 }}
                            onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                            aria-label={`${tCommon("remove")} ${t(`channels.${r.channel.key}`)} #${r.n}`}
                          >
                            <X size={13} />
                          </button>
                        ) : (
                          r.n === 1 &&
                          (r.include || existing) && (
                            <button className="ks-link" onClick={() => addAnother(r)}>
                              <Plus size={12} /> {t("addAnother")}
                            </button>
                          )
                        )}
                      </div>
                      {active && r.channel.ownUrl && (
                        <div className="ks-row-url">
                          <span className="muted">{t("qrGoesTo")}</span>
                          <input
                            className={`input ${r.url.trim() && !urlOk(r.url) ? "ks-cell-bad" : ""}`}
                            type="url"
                            value={r.url}
                            onChange={(e) => updateRow(r.id, { url: e.target.value })}
                            placeholder={landingUrl || "https://"}
                            aria-label={`${t("qrGoesTo")} — ${t(`channels.${r.channel.key}`)}`}
                          />
                          {r.url.trim() && !urlOk(r.url) && <span className="ks-warn">{t("urlInvalid")}</span>}
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
          <h1 ref={headingRef} tabIndex={-1}>
            {t("q.goals")}
          </h1>
          <p className="ks-sub">{t("q.goalsSub")}</p>
          {totalOnlyGoal !== null && (
            <p className="ks-warn" style={{ marginBottom: 12 }}>
              <AlertTriangle size={14} /> {t("totalOnlyWarning", { n: totalOnlyGoal.toLocaleString() })}
            </p>
          )}
          <div className="ks-goals">
            {goalMediums.map((m) => {
              const sug = suggestedGoal(m);
              const n = newPieces(m);
              const ref = perLinkAvg[m];
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
                    aria-label={`${t("goalLabel")} — ${m}`}
                  />
                  <span className="ks-hint ks-goal-ref">
                    {ref
                      ? mode === "existing" && initialGoals[m]
                        ? t("goalRefExisting", { cur: initialGoals[m], avg: ref.avg, n, sug: sug ?? 0, links: ref.links })
                        : t("goalRef", { avg: ref.avg, n, sug: sug ?? 0, links: ref.links })
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
              disabled={!goalMediums.some((m) => suggestedGoal(m))}
              onClick={() =>
                setGoals((g) => {
                  const next = { ...g };
                  for (const m of goalMediums) {
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
                n: goalMediums.reduce((s, m) => s + (parseInt(goals[m] ?? "", 10) || 0), 0).toLocaleString(),
              })}
            </span>
          </div>
          <p className="ks-hint" style={{ marginTop: 12 }}>
            {t("goalRefNote")} {startDay && endDay ? t("goalPaceNote") : t("goalSkipNote")}
          </p>
        </section>
      )}

      {/* ---------- Step: review ---------- */}
      {step === "review" && (
        <section className="ks-step">
          <h1 ref={headingRef} tabIndex={-1}>
            {t("q.review")}
          </h1>
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
              <dd>
                {ownerResolved
                  ? ownerLabel(members?.find((m) => m.id === ownerResolved) ?? { id: "", name: null, image: null })
                  : t("ownerUnassigned")}
              </dd>
            </div>
            <div>
              <dt>{t("goalLabel")}</dt>
              <dd>
                {goalMediums.filter((m) => parseInt(goals[m] ?? "", 10) > 0).length > 0
                  ? goalMediums
                      .filter((m) => parseInt(goals[m] ?? "", 10) > 0)
                      .map((m) => `${m} ${parseInt(goals[m], 10).toLocaleString()}`)
                      .join(" · ")
                  : t("notSet")}
              </dd>
            </div>
            <div>
              <dt>
                <label htmlFor="ks-prefix">{t("prefixLabel")}</label>
              </dt>
              <dd>
                <input
                  id="ks-prefix"
                  className="input"
                  style={{ height: 30, maxWidth: 160, fontFamily: "var(--font-mono)" }}
                  value={prefixOverride ?? prefix}
                  onChange={(e) => setPrefixOverride(looseCode(e.target.value))}
                />
              </dd>
            </div>
          </dl>

          <div className="table-scroll ks-review-table">
            <table className="data" style={{ tableLayout: "fixed", minWidth: 980 }}>
              <thead>
                <tr>
                  <th style={{ width: "26%" }}>{t("colTitle")}</th>
                  <th style={{ width: 150 }}>{t("colChannel")}</th>
                  <th style={{ width: 160 }}>utm_content</th>
                  <th style={{ width: 200 }}>{t("colCode")}</th>
                  <th>{t("colUrl")}</th>
                </tr>
              </thead>
              <tbody>
                {planRows.map((r) => {
                  const codeProblem = rowCodeProblem(r);
                  const contentProblem = rowContentProblem(r);
                  const code = rowCode(r);
                  const title = rowTitle(r);
                  return (
                    <tr key={r.id}>
                      <td>
                        <input
                          className="input ks-cell"
                          value={r.title ?? title}
                          onChange={(e) => updateRow(r.id, { title: e.target.value })}
                          aria-label={`${t("colTitle")} — ${title}`}
                        />
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
                          className={`input ks-cell ${contentProblem ? "ks-cell-bad" : ""}`}
                          style={{ fontFamily: "var(--font-mono)" }}
                          value={r.content ?? rowContent(r)}
                          onChange={(e) => updateRow(r.id, { content: looseCampaign(e.target.value) })}
                          aria-label={`utm_content — ${title}`}
                        />
                        {contentProblem && <div className="ks-code-status bad">{contentProblem}</div>}
                      </td>
                      <td>
                        <input
                          className={`input ks-cell ${codeProblem ? "ks-cell-bad" : ""}`}
                          style={{ fontFamily: "var(--font-mono)" }}
                          value={r.code ?? code}
                          onChange={(e) => updateRow(r.id, { code: looseCode(e.target.value) })}
                          placeholder={t("codeRandom")}
                          aria-label={`${t("colCode")} — ${title}`}
                        />
                        <div className={`ks-code-status ${codeProblem ? "bad" : ""}`}>
                          {codeProblem ??
                            (code ? (codeStatus[code] ? `✓ ${t("codeOk")}` : t("codeChecking")) : t("codeRandomHint"))}
                        </div>
                      </td>
                      <td>
                        <input
                          className={`input ks-cell ${urlOk(rowUrl(r)) ? "" : "ks-cell-bad"}`}
                          value={r.url}
                          onChange={(e) => updateRow(r.id, { url: e.target.value })}
                          placeholder={landingUrl}
                          aria-label={`${t("colUrl")} — ${title}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {badRows > 0 && (
            <p className="ks-warn" style={{ marginTop: 12 }}>
              <AlertTriangle size={14} /> {t("rowsNeedFix", { n: badRows })}
            </p>
          )}
          {failed.length > 0 && (
            <div className="ks-warn-box" role="alert">
              <strong>
                <AlertTriangle size={14} /> {t("someFailed", { n: failed.length, ok: created.length })}
              </strong>
              <ul>
                {failed.map((f) => {
                  const r = rowById(f.rowId);
                  return <li key={f.rowId}>{t("failedRow", { title: r ? rowTitle(r) : f.rowId, error: f.error ?? "" })}</li>;
                })}
              </ul>
            </div>
          )}
          {createError && (
            <p className="ks-warn" role="alert">
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
            {creating || codesPending ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}{" "}
            {failed.length > 0 ? t("retryFailed", { n: planRows.length }) : t("createN", { n: planRows.length })}
          </button>
        ) : step !== "type" ? (
          <button className="btn btn-primary" onClick={() => go(STEPS[stepIdx + 1])} disabled={!canNext[step]}>
            {step === "goals" && goalMediums.every((m) => !goals[m]) ? t("skip") : t("next")} <ArrowRight size={13} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
