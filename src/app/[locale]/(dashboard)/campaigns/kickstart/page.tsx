"use client";

/**
 * Campaign Kickstart — wizard that lets new marketers spin up an
 * entire campaign's tracked-link set from a playbook (Product Launch /
 * Exhibition Event) instead of hand-building each link.
 *
 * Guidance is built in throughout: an orientation card up top, a
 * "why this matters" line under each step, an expandable UTM field
 * glossary (for the non-obvious source/medium/content distinction),
 * and a post-create "what's next" checklist so new hires learn by
 * doing.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Rocket,
  Sparkles,
  ChevronLeft,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Info,
  ArrowRight,
  Layers,
  Copy as CopyIcon,
  Plus,
} from "lucide-react";
import {
  PLAYBOOKS,
  type Playbook,
  type PlaybookChannel,
} from "@/lib/campaign-playbooks";
import { PageHeader } from "@/components/layout/PageHeader";

interface PlanRow extends PlaybookChannel {
  include: boolean;
  title: string;
}

interface RowResult {
  rowId: string;
  ok: boolean;
  shortCode?: string;
  error?: string;
}

const UTM_GUIDE_URL =
  "https://terrelyeh.github.io/comms-docs/utm-parameters-guide.html";

export default function KickstartPage() {
  const t = useTranslations("campaigns");
  const router = useRouter();
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected: Playbook | undefined = useMemo(
    () => PLAYBOOKS.find((p) => p.id === selectedId),
    [selectedId],
  );

  const [utmCampaign, setUtmCampaign] = useState("");
  const [landingUrl, setLandingUrl] = useState("");
  const [rows, setRows] = useState<PlanRow[]>([]);

  const [creating, setCreating] = useState(false);
  const [results, setResults] = useState<RowResult[] | null>(null);

  // Resolve localized label / hint for a playbook channel. Falls back
  // to the English default baked into campaign-playbooks.ts if the
  // i18n key doesn't exist (next-intl doesn't have built-in defaults).
  const channelText = (
    playbookId: string,
    channelId: string,
    field: "label" | "hint",
    fallback: string,
  ): string => {
    try {
      const v = t(
        `kickstartPlaybooks.${playbookId}.channels.${channelId}.${field}` as never,
      );
      return v || fallback;
    } catch {
      return fallback;
    }
  };

  const playbookText = (
    playbookId: string,
    field: "name" | "description",
    fallback: string,
  ): string => {
    try {
      return t(`kickstartPlaybooks.${playbookId}.${field}` as never) || fallback;
    } catch {
      return fallback;
    }
  };

  const pickPlaybook = (p: Playbook) => {
    setSelectedId(p.id);
    setRows(
      p.channels.map((c) => ({
        ...c,
        include: c.defaultInclude ?? true,
        title: channelText(p.id, c.id, "label", c.label),
      })),
    );
    setResults(null);
  };

  const updateRow = (id: string, patch: Partial<PlanRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  /**
   * Duplicate a row and insert it just after the source. Useful when
   * you need more than the playbook's default count — e.g. 3 EDMs
   * instead of 2. Appends a suffix to utm_content + title so the new
   * row starts distinct (user can edit freely).
   */
  const duplicateRow = (id: string) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx === -1) return prev;
      const src = prev[idx];
      const siblings = prev.filter(
        (r) =>
          r.utmSource === src.utmSource && r.utmMedium === src.utmMedium,
      );
      const nextIndex = siblings.length + 1;
      const suffix = `_v${nextIndex}`;
      const clone: PlanRow = {
        ...src,
        id: `${src.id}_${crypto.randomUUID().slice(0, 8)}`,
        include: true,
        // Only append suffix if content doesn't already end in _vN, so
        // repeated dupes don't stack up (_v2_v2_v2).
        utmContent: /_v\d+$/.test(src.utmContent)
          ? src.utmContent.replace(/_v\d+$/, suffix)
          : `${src.utmContent}${suffix}`,
        title: `${src.title} (copy)`,
        hint: undefined,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
  };

  /**
   * Blank row for channels that aren't in the playbook (e.g. adding
   * an unexpected Twitter/X post). User fills every field.
   */
  const addBlankRow = () => {
    if (!selected) return;
    const id = `custom_${crypto.randomUUID().slice(0, 8)}`;
    setRows((prev) => [
      ...prev,
      {
        id,
        label: "",
        utmSource: "",
        utmMedium: "",
        utmContent: "",
        include: true,
        title: "",
        hint: undefined,
      },
    ]);
  };

  const canonicalCampaign = utmCampaign
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-]/g, "_")
    .replace(/_+/g, "_");

  const existingLinksQuery = useQuery<{
    links: Array<{
      id: string;
      code: string;
      utmSource: string | null;
      utmMedium: string | null;
      utmContent: string | null;
    }>;
  }>({
    queryKey: ["campaign-links", canonicalCampaign] as const,
    enabled: canonicalCampaign.length >= 3 && Boolean(selected),
    queryFn: async () => {
      const res = await fetch(
        `/api/links?campaign=${encodeURIComponent(canonicalCampaign)}&limit=200`,
      );
      if (!res.ok) return { links: [] };
      return res.json();
    },
  });

  const existingCombo = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of existingLinksQuery.data?.links ?? []) {
      const key = `${l.utmSource ?? ""}|${l.utmMedium ?? ""}|${l.utmContent ?? ""}`;
      if (!map.has(key)) map.set(key, l.code);
    }
    return map;
  }, [existingLinksQuery.data]);

  const existingLinkCount = existingLinksQuery.data?.links.length ?? 0;
  const isExtending = existingLinkCount > 0;

  const autoUncheckedKeyRef = useRef<string>("");
  useEffect(() => {
    const key = `${selectedId ?? ""}|${canonicalCampaign}`;
    if (!selected || !canonicalCampaign || existingLinksQuery.isFetching) return;
    if (autoUncheckedKeyRef.current === key) return;
    if (existingCombo.size === 0) {
      autoUncheckedKeyRef.current = key;
      return;
    }
    setRows((prev) =>
      prev.map((r) => {
        const comboKey = `${r.utmSource}|${r.utmMedium}|${r.utmContent}`;
        return existingCombo.has(comboKey) ? { ...r, include: false } : r;
      }),
    );
    autoUncheckedKeyRef.current = key;
  }, [
    selected,
    selectedId,
    canonicalCampaign,
    existingCombo,
    existingLinksQuery.isFetching,
  ]);

  const includedRows = rows.filter((r) => r.include);
  const successCount = results?.filter((r) => r.ok).length ?? 0;
  const failedCount = results?.filter((r) => !r.ok).length ?? 0;
  const allSuccess = results !== null && failedCount === 0 && successCount > 0;

  // Every included row must carry its three UTM identifiers. Blank-row
  // adds can otherwise leak through and create links that Analytics
  // can't bucket by channel. (P1 from Codex review.)
  const hasIncompleteRow = includedRows.some(
    (r) => !r.utmSource.trim() || !r.utmMedium.trim() || !r.utmContent.trim(),
  );

  const canCreate =
    Boolean(selected) &&
    canonicalCampaign.length >= 3 &&
    /^https?:\/\//i.test(landingUrl.trim()) &&
    includedRows.length > 0 &&
    !hasIncompleteRow &&
    !creating;

  const handleCreateAll = async () => {
    if (!canCreate) return;
    setCreating(true);
    const batch: RowResult[] = [];

    for (const row of includedRows) {
      try {
        const res = await fetch("/api/links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalUrl: landingUrl.trim(),
            title: row.title,
            utmSource: row.utmSource,
            utmMedium: row.utmMedium,
            utmCampaign: canonicalCampaign,
            utmContent: row.utmContent,
            redirectType: "TEMPORARY",
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          batch.push({ rowId: row.id, ok: true, shortCode: data.code });
        } else {
          batch.push({
            rowId: row.id,
            ok: false,
            error:
              typeof data.error === "string"
                ? data.error
                : `HTTP ${res.status}`,
          });
        }
      } catch (err) {
        batch.push({
          rowId: row.id,
          ok: false,
          error: err instanceof Error ? err.message : "Network error",
        });
      }
    }

    setResults(batch);
    setCreating(false);

    // Uncheck successfully-created rows so partial-failure retries
    // can't resubmit already-saved channels and duplicate them in the
    // campaign. (P0 from Codex review.)
    const createdIds = new Set(batch.filter((b) => b.ok).map((b) => b.rowId));
    if (createdIds.size > 0) {
      setRows((prev) =>
        prev.map((r) => (createdIds.has(r.id) ? { ...r, include: false } : r)),
      );
    }

    // Invalidate every cache that could reasonably show these new
    // links. Without `campaign-links` the Campaign Detail Links tab
    // keeps stale data until the next SyncButton click. (P0.)
    qc.invalidateQueries({ queryKey: ["links"], refetchType: "all" });
    qc.invalidateQueries({ queryKey: ["campaigns-summary"], refetchType: "all" });
    qc.invalidateQueries({ queryKey: ["analytics-raw"], refetchType: "all" });
    qc.invalidateQueries({ queryKey: ["utm-campaigns"], refetchType: "all" });
    qc.invalidateQueries({
      queryKey: ["campaign-links", canonicalCampaign],
      refetchType: "all",
    });
  };

  return (
    <div className="stack" style={{ gap: 24 }}>
      <PageHeader
        title={t("kickstartTitle")}
        description={t("kickstartDescription")}
        actions={
          <>
            <a
              href={UTM_GUIDE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              <BookOpen size={13} /> {t("kickstartUtmGuide")}
            </a>
            <button
              className="btn btn-secondary"
              onClick={() => router.push("/campaigns")}
            >
              <ChevronLeft size={13} /> {t("kickstartBack")}
            </button>
          </>
        }
      />

      <Orientation t={t} />

      <div className="card card-padded">
        <SectionHead
          number="1"
          title={t("kickstartStep1Title")}
          helpTitle={t("kickstartStep1HelpTitle")}
          help={t("kickstartStep1Help")}
          whyShow={t("kickstartWhyShow")}
          whyHide={t("kickstartWhyHide")}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
            marginTop: 16,
          }}
        >
          {PLAYBOOKS.map((p) => {
            const active = p.id === selectedId;
            return (
              <button
                key={p.id}
                onClick={() => pickPlaybook(p)}
                className="card card-padded"
                style={{
                  cursor: "pointer",
                  textAlign: "left",
                  borderColor: active
                    ? "var(--brand-500)"
                    : "var(--border-strong)",
                  background: active ? "var(--brand-50)" : "var(--bg-card)",
                  transition: "all .15s var(--ease)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkles
                    size={14}
                    style={{ color: active ? "var(--brand-700)" : "var(--ink-400)" }}
                  />
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: active ? "var(--brand-700)" : "var(--ink-100)",
                    }}
                  >
                    {playbookText(p.id, "name", p.name)}
                  </div>
                </div>
                <p
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    color: "var(--ink-400)",
                    lineHeight: 1.55,
                  }}
                >
                  {playbookText(p.id, "description", p.description)}
                </p>
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 11.5,
                    color: "var(--ink-500)",
                  }}
                >
                  {t("kickstartPlaybookChannels", {
                    count: p.channels.length,
                    hint: p.campaignHint,
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <>
          <div className="card card-padded">
            <SectionHead
              number="2"
              title={t("kickstartStep2Title")}
              helpTitle={t("kickstartStep2HelpTitle")}
              help={t("kickstartStep2Help")}
              whyShow={t("kickstartWhyShow")}
              whyHide={t("kickstartWhyHide")}
            />

            <div className="grid-resp-2" style={{ marginTop: 16 }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--ink-200)",
                    marginBottom: 6,
                  }}
                >
                  {t("kickstartStep2UtmCampaignLabel")}{" "}
                  <span style={{ color: "var(--err-fg)" }}>*</span>
                </label>
                <input
                  type="text"
                  value={utmCampaign}
                  onChange={(e) => setUtmCampaign(e.target.value)}
                  placeholder={selected.campaignHint}
                  className="input"
                  style={{
                    width: "100%",
                    fontFamily: "var(--font-mono)",
                    fontSize: 13.5,
                  }}
                />
                {utmCampaign && utmCampaign !== canonicalCampaign && (
                  <p
                    style={{
                      marginTop: 6,
                      fontSize: 11.5,
                      color: "var(--ink-500)",
                    }}
                  >
                    {t("kickstartStep2SavedAs")}{" "}
                    <code
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: "var(--brand-700)",
                      }}
                    >
                      {canonicalCampaign}
                    </code>
                  </p>
                )}
                {isExtending && (
                  <p
                    style={{
                      marginTop: 6,
                      fontSize: 11.5,
                      color: "#7C3AED",
                      fontWeight: 500,
                    }}
                  >
                    {t("kickstartStep2AlreadyExists", {
                      count: existingLinkCount,
                    })}
                  </p>
                )}
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--ink-200)",
                    marginBottom: 6,
                  }}
                >
                  {t("kickstartStep2LandingLabel")}{" "}
                  <span style={{ color: "var(--err-fg)" }}>*</span>
                </label>
                <input
                  type="url"
                  value={landingUrl}
                  onChange={(e) => setLandingUrl(e.target.value)}
                  placeholder="https://engeniustech.com/..."
                  className="input"
                  style={{ width: "100%", fontSize: 13.5 }}
                />
              </div>
            </div>
          </div>

          {isExtending && (
            <div
              className="card card-padded"
              style={{
                background: "#F5F3FF",
                borderColor: "#7C3AED",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <Layers size={18} style={{ color: "#7C3AED", marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 14.5,
                      fontWeight: 600,
                      color: "#5B21B6",
                    }}
                  >
                    {t("kickstartExtendingHeading")}
                  </h3>
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: 13,
                      color: "var(--ink-300)",
                      lineHeight: 1.65,
                    }}
                  >
                    {t.rich("kickstartExtendingBody", {
                      campaign: canonicalCampaign,
                      count: existingLinkCount,
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="card card-padded">
            <div className="row-between" style={{ alignItems: "flex-start" }}>
              <SectionHead
                number="3"
                title={t("kickstartStep3Title")}
                helpTitle={t("kickstartStep3HelpTitle")}
                help={t("kickstartStep3Help")}
                whyShow={t("kickstartWhyShow")}
                whyHide={t("kickstartWhyHide")}
              />
              <span
                style={{ fontSize: 11.5, color: "var(--ink-500)", marginTop: 4 }}
              >
                {isExtending
                  ? t("kickstartStep3SelectedWithExisting", {
                      included: includedRows.length,
                      total: rows.length,
                      existing: existingLinkCount,
                    })
                  : t("kickstartStep3Selected", {
                      included: includedRows.length,
                      total: rows.length,
                    })}
              </span>
            </div>

            <div className="table-scroll" style={{ marginTop: 16 }}>
            <table className="data" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th style={{ minWidth: 180 }}>{t("kickstartColChannel")}</th>
                  <th>
                    <HeaderWithHelp
                      label="source"
                      helpTitle={t("kickstartSourceHelpTitle")}
                      helpBody={t("kickstartSourceHelpBody")}
                    />
                  </th>
                  <th>
                    <HeaderWithHelp
                      label="medium"
                      helpTitle={t("kickstartMediumHelpTitle")}
                      helpBody={t("kickstartMediumHelpBody")}
                    />
                  </th>
                  <th>
                    <HeaderWithHelp
                      label="content"
                      helpTitle={t("kickstartContentHelpTitle")}
                      helpBody={t("kickstartContentHelpBody")}
                    />
                  </th>
                  <th style={{ width: 72 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const rowResult = results?.find((r) => r.rowId === row.id);
                  const comboKey = `${row.utmSource}|${row.utmMedium}|${row.utmContent}`;
                  const existingCode = existingCombo.get(comboKey);
                  const localizedHint =
                    selected && row.hint
                      ? channelText(selected.id, row.id, "hint", row.hint)
                      : "";
                  return (
                    <tr key={row.id} style={{ opacity: row.include ? 1 : 0.55 }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={row.include}
                          onChange={(e) =>
                            updateRow(row.id, { include: e.target.checked })
                          }
                          style={{ cursor: "pointer" }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={row.title}
                          onChange={(e) =>
                            updateRow(row.id, { title: e.target.value })
                          }
                          className="input"
                          style={{
                            width: "100%",
                            fontSize: 13,
                            padding: "4px 8px",
                            height: 30,
                          }}
                          disabled={!row.include}
                        />
                        {localizedHint && !existingCode && (
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--ink-500)",
                              marginTop: 2,
                            }}
                          >
                            {localizedHint}
                          </div>
                        )}
                        {existingCode && !rowResult && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              marginTop: 4,
                              fontSize: 11,
                              color: "#7C3AED",
                              fontWeight: 500,
                            }}
                          >
                            <Layers size={11} />
                            {t("kickstartRowExists")} ·{" "}
                            <code
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: 11,
                              }}
                            >
                              /{existingCode}
                            </code>
                          </div>
                        )}
                        {rowResult && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              marginTop: 4,
                              fontSize: 11,
                              color: rowResult.ok
                                ? "var(--ok-fg)"
                                : "var(--err-fg)",
                            }}
                          >
                            {rowResult.ok ? (
                              <>
                                <CheckCircle2 size={11} />
                                {t("kickstartRowCreated")} · /
                                {rowResult.shortCode}
                              </>
                            ) : (
                              <>
                                <AlertCircle size={11} />
                                {rowResult.error}
                              </>
                            )}
                          </div>
                        )}
                      </td>
                      <MonoCell
                        value={row.utmSource}
                        disabled={!row.include}
                        onChange={(v) => updateRow(row.id, { utmSource: v })}
                      />
                      <MonoCell
                        value={row.utmMedium}
                        disabled={!row.include}
                        onChange={(v) => updateRow(row.id, { utmMedium: v })}
                      />
                      <MonoCell
                        value={row.utmContent}
                        disabled={!row.include}
                        onChange={(v) => updateRow(row.id, { utmContent: v })}
                      />
                      <td>
                        <div style={{ display: "flex", gap: 2 }}>
                          <button
                            onClick={() => duplicateRow(row.id)}
                            className="btn btn-ghost"
                            title={t("kickstartRowDuplicate")}
                            style={{ padding: "4px 6px", height: 30 }}
                          >
                            <CopyIcon size={12} />
                          </button>
                          <button
                            onClick={() => removeRow(row.id)}
                            className="btn btn-ghost"
                            title={t("kickstartRowRemove")}
                            style={{ padding: "4px 6px", height: 30 }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-start" }}>
              <button
                className="btn btn-secondary"
                onClick={addBlankRow}
                title={t("kickstartAddBlankRowHint")}
              >
                <Plus size={13} /> {t("kickstartAddBlankRow")}
              </button>
            </div>
          </div>

          {!allSuccess && (
            <div
              className="card card-padded"
              style={{
                position: "sticky",
                bottom: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 13, color: "var(--ink-400)" }}>
                {canCreate
                  ? t.rich("kickstartSubmitWillCreate", {
                      count: includedRows.length,
                      campaign: canonicalCampaign,
                    })
                  : hasIncompleteRow
                    ? t("kickstartSubmitIncompleteRow")
                    : t("kickstartSubmitNeedFields")}
              </div>
              <button
                className="btn btn-primary"
                disabled={!canCreate}
                onClick={handleCreateAll}
              >
                {creating ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />{" "}
                    {t("kickstartSubmitCreating")}
                  </>
                ) : (
                  <>
                    <Rocket size={13} />{" "}
                    {t("kickstartSubmitCreate", { count: includedRows.length })}
                  </>
                )}
              </button>
            </div>
          )}

          {allSuccess && (
            <NextSteps
              t={t}
              campaign={canonicalCampaign}
              count={successCount}
              onOpenCampaign={() =>
                router.push(
                  `/campaigns/${encodeURIComponent(canonicalCampaign)}`,
                )
              }
            />
          )}

          {results && failedCount > 0 && (
            <div
              className="card card-padded"
              style={{ borderColor: "var(--err-fg)" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: "var(--err-fg)",
                  fontWeight: 600,
                  marginBottom: 6,
                }}
              >
                <AlertCircle size={14} />
                {t("kickstartErrorsHeading", { count: failedCount })}
              </div>
              <p style={{ fontSize: 13, color: "var(--ink-400)", margin: 0 }}>
                {t("kickstartErrorsBody")}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------- subcomponents ----------

function Orientation({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="card card-padded"
      style={{
        background: "var(--brand-50)",
        borderColor: "var(--brand-100)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <Info size={18} style={{ color: "var(--brand-700)", marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 600,
              color: "var(--brand-700)",
            }}
          >
            {t("kickstartOrientationHeading")}
          </h3>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 13.5,
              color: "var(--ink-200)",
              lineHeight: 1.65,
            }}
          >
            {t("kickstartOrientationIntro")}
          </p>
          {expanded && (
            <div
              style={{
                marginTop: 12,
                fontSize: 13,
                color: "var(--ink-300)",
                lineHeight: 1.75,
              }}
            >
              <p style={{ margin: "0 0 8px" }}>
                <strong>{t("kickstartOrientationWhenLabel")}</strong>{" "}
                {t("kickstartOrientationWhenBody")}
              </p>
              <p style={{ margin: "0 0 8px" }}>
                <strong>{t("kickstartOrientationWhenNotLabel")}</strong>{" "}
                {t("kickstartOrientationWhenNotBody")}
              </p>
              <p style={{ margin: 0 }}>
                <strong>{t("kickstartOrientationNewLabel")}</strong>{" "}
                {t("kickstartOrientationNewBody")}{" "}
                <a
                  href={UTM_GUIDE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--brand-700)", fontWeight: 600 }}
                >
                  {t("kickstartUtmGuide")} ↗
                </a>
              </p>
            </div>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              marginTop: 8,
              padding: 0,
              background: "none",
              border: 0,
              color: "var(--brand-700)",
              fontSize: 12.5,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {expanded
              ? t("kickstartOrientationCollapse")
              : t("kickstartOrientationExpand")}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionHead({
  number,
  title,
  helpTitle,
  help,
  whyShow,
  whyHide,
}: {
  number: string;
  title: string;
  helpTitle: string;
  help: React.ReactNode;
  whyShow: string;
  whyHide: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: "var(--brand-50)",
            color: "var(--brand-700)",
            fontSize: 12,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {number}
        </span>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink-100)" }}>
          {title}
        </div>
      </div>
      <p
        style={{
          margin: "6px 0 0 32px",
          fontSize: 13,
          color: "var(--ink-400)",
          lineHeight: 1.55,
        }}
      >
        {helpTitle}{" "}
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            background: "none",
            border: 0,
            padding: 0,
            color: "var(--brand-700)",
            fontSize: 12.5,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {expanded ? whyHide : whyShow}
        </button>
      </p>
      {expanded && (
        <div
          style={{
            margin: "10px 0 0 32px",
            padding: "10px 14px",
            background: "var(--bg-subtle)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--ink-300)",
            lineHeight: 1.7,
          }}
        >
          {help}
        </div>
      )}
    </div>
  );
}

function HeaderWithHelp({
  label,
  helpTitle,
  helpBody,
}: {
  label: string;
  helpTitle: string;
  helpBody: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {label}
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{
          background: "none",
          border: 0,
          padding: 0,
          cursor: "pointer",
          color: open ? "var(--brand-500)" : "var(--ink-500)",
          display: "inline-flex",
          alignItems: "center",
          marginLeft: 2,
        }}
        aria-label={helpTitle}
      >
        <Info size={11} />
      </button>
      {open && (
        <span
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: -8,
            zIndex: 30,
            width: 260,
            padding: "10px 12px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-strong)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
            fontSize: 12,
            color: "var(--ink-200)",
            lineHeight: 1.6,
            textTransform: "none",
            letterSpacing: 0,
            fontWeight: 400,
          }}
        >
          <strong style={{ display: "block", marginBottom: 4 }}>
            {helpTitle}
          </strong>
          {helpBody}
        </span>
      )}
    </span>
  );
}

function MonoCell({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <td>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.toLowerCase())}
        className="input"
        style={{
          width: "100%",
          fontSize: 12.5,
          padding: "4px 8px",
          height: 30,
          fontFamily: "var(--font-mono)",
        }}
        disabled={disabled}
      />
    </td>
  );
}

function NextSteps({
  t,
  campaign,
  count,
  onOpenCampaign,
}: {
  t: ReturnType<typeof useTranslations>;
  campaign: string;
  count: number;
  onOpenCampaign: () => void;
}) {
  return (
    <div
      className="card card-padded"
      style={{
        background: "#F0FDF4",
        borderColor: "rgba(22,163,74,0.35)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <CheckCircle2 size={18} style={{ color: "var(--ok-fg)" }} />
        <h3
          style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#166534" }}
        >
          {t("kickstartNextStepsHeading", { count, campaign })}
        </h3>
      </div>
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13.5,
          color: "#166534",
          lineHeight: 1.65,
        }}
      >
        {t("kickstartNextStepsIntro")}
      </p>
      <ol
        style={{
          margin: 0,
          paddingLeft: 20,
          color: "#166534",
          lineHeight: 1.9,
          fontSize: 13.5,
        }}
      >
        <li>{t("kickstartNextStep1")}</li>
        <li>{t("kickstartNextStep2")}</li>
        <li>{t("kickstartNextStep3")}</li>
        <li>{t("kickstartNextStep4")}</li>
      </ol>
      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button className="btn btn-primary" onClick={onOpenCampaign}>
          {t("kickstartOpenCampaign", { campaign })} <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
