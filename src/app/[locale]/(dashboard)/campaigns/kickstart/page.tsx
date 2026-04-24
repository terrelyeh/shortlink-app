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

  const pickPlaybook = (p: Playbook) => {
    setSelectedId(p.id);
    setRows(
      p.channels.map((c) => ({
        ...c,
        include: true,
        title: c.label,
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

  const canonicalCampaign = utmCampaign
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-]/g, "_")
    .replace(/_+/g, "_");

  // --- Existing-campaign detection ---------------------------------
  // If the user types a utm_campaign value that already exists in the
  // workspace, we look up its current links so we can show which
  // channels are done vs missing. This turns Kickstart into an
  // "extend existing campaign" flow, not just a new-campaign wizard.
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

  // Map of "source|medium|content" → existing short code for O(1) lookup.
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

  // Auto-uncheck rows whose UTM combo already exists — but only once
  // per (selected playbook × canonicalCampaign) pair, so we don't
  // stomp on the user's manual re-check mid-edit.
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

  const canCreate =
    Boolean(selected) &&
    canonicalCampaign.length >= 3 &&
    /^https?:\/\//i.test(landingUrl.trim()) &&
    includedRows.length > 0 &&
    !creating;

  const handleCreateAll = async () => {
    if (!canCreate) return;
    setCreating(true);
    const batch: RowResult[] = [];

    // Sequential — simpler, and avoids racing the short-code uniqueness
    // generator on the server side.
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

    qc.invalidateQueries({ queryKey: ["links"], refetchType: "all" });
    qc.invalidateQueries({ queryKey: ["campaigns-summary"], refetchType: "all" });
    qc.invalidateQueries({ queryKey: ["analytics-raw"], refetchType: "all" });
    qc.invalidateQueries({ queryKey: ["utm-campaigns"], refetchType: "all" });
  };

  return (
    <div className="stack" style={{ gap: 24 }}>
      <PageHeader
        title="Campaign Kickstart"
        description="Pick a playbook, fill the basics, and spin up every channel's tracked link in one go."
        actions={
          <>
            <a
              href={UTM_GUIDE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              <BookOpen size={13} /> UTM Guide
            </a>
            <button
              className="btn btn-secondary"
              onClick={() => router.push("/campaigns")}
            >
              <ChevronLeft size={13} /> Back
            </button>
          </>
        }
      />

      {/* Orientation — first-time users land here and need to know why
          this page exists and when NOT to use it. */}
      <Orientation />

      {/* Step 1 — playbook picker */}
      <div className="card card-padded">
        <SectionHead
          number="1"
          title="Pick a playbook"
          helpTitle="A playbook is the typical channel mix for a campaign type."
          help="Every row in the playbook becomes one short link — all of them share your landing URL + utm_campaign, but each has its own source / medium / content so you can later compare which channel drove the most traffic."
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
                    {p.name}
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
                  {p.description}
                </p>
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 11.5,
                    color: "var(--ink-500)",
                  }}
                >
                  {p.channels.length} channels · hint:{" "}
                  <code
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11.5,
                      color: "var(--ink-300)",
                    }}
                  >
                    {p.campaignHint}
                  </code>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <>
          {/* Step 2 — basics */}
          <div className="card card-padded">
            <SectionHead
              number="2"
              title="Campaign basics"
              helpTitle="These two fields apply to every link in this campaign."
              help={
                <>
                  <strong>utm_campaign</strong> is the id that groups all
                  links under one campaign in your Analytics — keep it
                  short, lowercase, underscored (we auto-normalize). The
                  <strong> landing URL</strong> is the page all these
                  links will redirect to.
                </>
              }
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                marginTop: 16,
              }}
            >
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
                  utm_campaign <span style={{ color: "var(--err-fg)" }}>*</span>
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
                    Saved as{" "}
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
                      color: "var(--data-violet, #7C3AED)",
                      fontWeight: 500,
                    }}
                  >
                    This campaign already exists ({existingLinkCount} link
                    {existingLinkCount === 1 ? "" : "s"}) — see banner below.
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
                  Landing URL <span style={{ color: "var(--err-fg)" }}>*</span>
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

          {/* Extending-existing banner */}
          {isExtending && (
            <div
              className="card card-padded"
              style={{
                background: "var(--violet-50, #F5F3FF)",
                borderColor: "var(--data-violet, #7C3AED)",
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
                    Extending an existing campaign
                  </h3>
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: 13,
                      color: "var(--ink-300)",
                      lineHeight: 1.65,
                    }}
                  >
                    <code
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: "#5B21B6",
                      }}
                    >
                      {canonicalCampaign}
                    </code>{" "}
                    already has <strong>{existingLinkCount}</strong> link
                    {existingLinkCount === 1 ? "" : "s"}. Rows matching an
                    existing channel have been unchecked — they already
                    exist. Only the checked rows will be added.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — channel table */}
          <div className="card card-padded">
            <div className="row-between" style={{ alignItems: "flex-start" }}>
              <SectionHead
                number="3"
                title="Channel plan"
                helpTitle="Uncheck rows you don't need, or tweak the UTM values per row."
                help={
                  <>
                    Each row becomes one short link. Short codes are
                    auto-generated. Source / medium / content values
                    have specific meanings — see the{" "}
                    <em>?</em> icons on the column headers for examples.
                  </>
                }
              />
              <span
                style={{ fontSize: 11.5, color: "var(--ink-500)", marginTop: 4 }}
              >
                {includedRows.length} of {rows.length} selected
                {isExtending && ` · ${existingLinkCount} already exist`}
              </span>
            </div>

            <table
              className="data"
              style={{ fontSize: 13, marginTop: 16 }}
            >
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th style={{ minWidth: 180 }}>Channel</th>
                  <th>
                    <HeaderWithHelp
                      label="source"
                      help={
                        <>
                          <strong>Who sent them.</strong> The specific
                          platform or mailing list — e.g. <code>facebook</code>,{" "}
                          <code>google</code>, <code>newsletter</code>,{" "}
                          <code>intercom</code>.
                        </>
                      }
                    />
                  </th>
                  <th>
                    <HeaderWithHelp
                      label="medium"
                      help={
                        <>
                          <strong>How they got here.</strong> The traffic
                          type — e.g. <code>email</code>, <code>social</code>,{" "}
                          <code>cpc</code> (paid), <code>referral</code>.
                        </>
                      }
                    />
                  </th>
                  <th>
                    <HeaderWithHelp
                      label="content"
                      help={
                        <>
                          <strong>Which creative.</strong> Distinguishes
                          different posts / emails / ads within the same
                          source+medium — e.g.{" "}
                          <code>edm_headline_a</code>,{" "}
                          <code>fb_organic_v1</code>.
                        </>
                      }
                    />
                  </th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const rowResult = results?.find((r) => r.rowId === row.id);
                  const comboKey = `${row.utmSource}|${row.utmMedium}|${row.utmContent}`;
                  const existingCode = existingCombo.get(comboKey);
                  return (
                    <tr
                      key={row.id}
                      style={{ opacity: row.include ? 1 : 0.55 }}
                    >
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
                        {row.hint && !existingCode && (
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--ink-500)",
                              marginTop: 2,
                            }}
                          >
                            {row.hint}
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
                            Already exists ·{" "}
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
                                Created · /{rowResult.shortCode}
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
                        <button
                          onClick={() => removeRow(row.id)}
                          className="btn btn-ghost"
                          title="Remove"
                          style={{ padding: "4px 6px", height: 30 }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Sticky submit bar */}
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
                {canCreate ? (
                  <>
                    Will create{" "}
                    <strong style={{ color: "var(--ink-100)" }}>
                      {includedRows.length} link
                      {includedRows.length === 1 ? "" : "s"}
                    </strong>{" "}
                    under campaign{" "}
                    <code
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: "var(--brand-700)",
                      }}
                    >
                      {canonicalCampaign}
                    </code>
                  </>
                ) : (
                  "Fill in a utm_campaign id (≥ 3 chars) and a landing URL (https://…) to continue."
                )}
              </div>
              <button
                className="btn btn-primary"
                disabled={!canCreate}
                onClick={handleCreateAll}
              >
                {creating ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Creating…
                  </>
                ) : (
                  <>
                    <Rocket size={13} /> Create {includedRows.length} link
                    {includedRows.length === 1 ? "" : "s"}
                  </>
                )}
              </button>
            </div>
          )}

          {/* Post-create success guidance — new hires land here and
              need to know what comes next, not just "success ✓". */}
          {allSuccess && (
            <NextSteps
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
                {failedCount} row{failedCount === 1 ? "" : "s"} failed
              </div>
              <p
                style={{ fontSize: 13, color: "var(--ink-400)", margin: 0 }}
              >
                Check the errors inline above. Successful rows are already
                saved — you can fix the failing rows and click Create
                again.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------- subcomponents ----------

function Orientation() {
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
            New to this tool? Read me first.
          </h3>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 13.5,
              color: "var(--ink-200)",
              lineHeight: 1.65,
            }}
          >
            Kickstart creates 8–10 tracked short links in one shot, each
            with the right UTM parameters for a specific marketing channel.
            Use this whenever you launch something with a full channel
            mix — it saves you from hand-building each link and making
            typos in UTM values.
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
                <strong>When to use:</strong> new product launches,
                exhibition events, webinars, big campaigns with multiple
                channels.
              </p>
              <p style={{ margin: "0 0 8px" }}>
                <strong>When NOT to use:</strong> one-off links (use{" "}
                <em>Links → Create link</em>), CSV imports of 50+ links
                (use <em>Links → Import CSV</em>).
              </p>
              <p style={{ margin: 0 }}>
                <strong>Never heard of UTM?</strong> Read the{" "}
                <a
                  href={UTM_GUIDE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--brand-700)", fontWeight: 600 }}
                >
                  UTM Parameters Guide
                </a>{" "}
                first (5 min read). It explains what source / medium /
                content actually mean.
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
            {expanded ? "Hide details ↑" : "Show when to / when not to use ↓"}
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
}: {
  number: string;
  title: string;
  helpTitle: string;
  help: React.ReactNode;
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
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--ink-100)",
          }}
        >
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
          {expanded ? "Hide why" : "Why?"}
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
  help,
}: {
  label: string;
  help: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4 }}>
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
        aria-label={`What is ${label}?`}
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
          {help}
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
  campaign,
  count,
  onOpenCampaign,
}: {
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
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <CheckCircle2 size={18} style={{ color: "var(--ok-fg)" }} />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#166534" }}>
          {count} link{count === 1 ? "" : "s"} created under {campaign}
        </h3>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "#166534", lineHeight: 1.65 }}>
        Here's what to do next — in order:
      </p>
      <ol style={{ margin: 0, paddingLeft: 20, color: "#166534", lineHeight: 1.9, fontSize: 13.5 }}>
        <li>
          <strong>Open the Campaign dashboard</strong> to see all the
          links you just created and their short URLs. Copy each one to
          the corresponding channel (EDM tool, FB post, etc.).
        </li>
        <li>
          <strong>Set a goal</strong> (optional) on the Campaign page so
          the Leaderboard shows your progress toward target clicks.
        </li>
        <li>
          <strong>After launch, check Analytics daily</strong> for the
          first week. Filter by this campaign to see which channel is
          pulling the most weight.
        </li>
        <li>
          <strong>Need to add a channel later?</strong> Don't run
          Kickstart again — use Links → Create link with the same
          utm_campaign value; it'll automatically attach to this
          campaign.
        </li>
      </ol>
      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button className="btn btn-primary" onClick={onOpenCampaign}>
          Open {campaign} <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
