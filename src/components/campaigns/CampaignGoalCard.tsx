"use client";

/**
 * Campaign click goal — a total, optionally split per channel (utm_medium),
 * with a pace line showing where the campaign should be by today if the
 * goal were reached evenly over the campaign period.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Target, X } from "lucide-react";
import { sumGoal, type GoalByMedium } from "@/lib/campaign-goal";

export interface GoalSaveBody {
  goalClicks?: number | null;
  goalByMedium?: GoalByMedium | null;
}

export function CampaignGoalCard({
  goalClicks,
  goalByMedium,
  basis,
  basisLabel,
  pace,
  showPaceHint,
  mediums,
  onSave,
}: {
  goalClicks: number | null;
  goalByMedium: GoalByMedium | null;
  /** Clicks that count toward the goal (campaign period, or all time). null = still loading. */
  basis: { total: number; byMedium: Record<string, number> } | null;
  basisLabel: string;
  /** Elapsed share of the campaign period (0–1) while it's running; null hides the pace line. */
  pace: number | null;
  /** Show the "set start & end dates to get a pace line" hint. */
  showPaceHint: boolean;
  /** utm_medium values used by this campaign's links (editor rows). */
  mediums: string[];
  onSave: (body: GoalSaveBody) => Promise<void>;
}) {
  const t = useTranslations("campaigns.detail");
  const tCommon = useTranslations("common");

  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<"total" | "channel">("total");
  const [totalInput, setTotalInput] = useState("");
  const [channelInputs, setChannelInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Editor rows: the campaign's mediums plus any already in the goal.
  const editorMediums = Array.from(new Set([...mediums, ...Object.keys(goalByMedium ?? {})]));

  const openEditor = () => {
    setMode(goalByMedium || (!goalClicks && mediums.length > 1) ? "channel" : "total");
    setTotalInput(goalClicks ? String(goalClicks) : "");
    setChannelInputs(
      Object.fromEntries(editorMediums.map((m) => [m, goalByMedium?.[m] ? String(goalByMedium[m]) : ""])),
    );
    setEditing(true);
  };

  const channelGoal: GoalByMedium = Object.fromEntries(
    Object.entries(channelInputs)
      .map(([m, v]) => [m, parseInt(v, 10)] as const)
      .filter(([, n]) => Number.isInteger(n) && n > 0),
  );
  const channelTotal = sumGoal(channelGoal);
  const totalParsed = parseInt(totalInput, 10);
  const canSave =
    !saving && (mode === "total" ? Number.isInteger(totalParsed) && totalParsed > 0 : channelTotal > 0);

  const run = async (body: GoalSaveBody) => {
    setSaving(true);
    try {
      await onSave(body);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (!canSave) return;
    return run(mode === "total" ? { goalClicks: totalParsed } : { goalByMedium: channelGoal });
  };

  const unassigned = basis
    ? Object.entries(basis.byMedium)
        .filter(([m, n]) => n > 0 && goalByMedium && !(m in goalByMedium))
        .sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="goal-card">
      <div className="goal-head">
        <div className="section-title" style={{ flexWrap: "wrap" }}>
          <Target size={14} style={{ color: "var(--data-violet)" }} />
          {t("clickGoal")}
          {goalClicks && (
            <span className="muted" style={{ fontWeight: 400, fontSize: 11.5 }}>
              · {basisLabel}
            </span>
          )}
        </div>
        <div className="row" style={{ gap: 4 }}>
          {goalClicks && !editing && (
            <button
              className="btn btn-ghost"
              style={{ padding: "4px 6px" }}
              onClick={() => run({ goalClicks: null })}
              disabled={saving}
              title={t("removeGoal")}
            >
              <X size={13} />
            </button>
          )}
          <button
            className="btn btn-ghost"
            style={{ padding: "4px 6px" }}
            onClick={() => (editing ? setEditing(false) : openEditor())}
            title={t("editGoal")}
          >
            <Pencil size={13} />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="goal-editor">
          <div className="segmented" style={{ alignSelf: "flex-start" }}>
            <button className={mode === "total" ? "active" : ""} onClick={() => setMode("total")}>
              {t("goalModeTotal")}
            </button>
            <button
              className={mode === "channel" ? "active" : ""}
              onClick={() => setMode("channel")}
              disabled={editorMediums.length === 0}
              title={editorMediums.length === 0 ? t("goalNoChannels") : undefined}
            >
              {t("goalModeChannel")}
            </button>
          </div>

          {mode === "total" ? (
            <input
              type="number"
              min={1}
              value={totalInput}
              onChange={(e) => setTotalInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setEditing(false);
              }}
              placeholder={t("goalPlaceholder")}
              className="input"
              style={{ height: 32, maxWidth: 240 }}
              autoFocus
            />
          ) : (
            <>
              <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                {t("goalChannelHint")}
              </p>
              <div className="goal-channel-inputs">
                {editorMediums.map((m) => (
                  <label key={m}>
                    <span className="pill pill-medium">{m}</span>
                    <input
                      type="number"
                      min={1}
                      className="input"
                      style={{ height: 30 }}
                      value={channelInputs[m] ?? ""}
                      onChange={(e) => setChannelInputs((s) => ({ ...s, [m]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") save();
                        if (e.key === "Escape") setEditing(false);
                      }}
                    />
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-300)" }}>
                {t("goalTotalAuto", { n: channelTotal.toLocaleString() })}
              </div>
            </>
          )}

          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-primary" onClick={save} disabled={!canSave}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : tCommon("save")}
            </button>
            <button className="btn btn-secondary" onClick={() => setEditing(false)}>
              {tCommon("cancel")}
            </button>
          </div>
        </div>
      ) : !goalClicks ? (
        <p className="placeholder" style={{ margin: 0 }}>
          {t("setGoalHint")}
        </p>
      ) : !basis ? (
        <div className="goal-progress" />
      ) : (
        <>
          <GoalRow
            label={goalByMedium ? t("goalTotalLabel") : null}
            isTotal
            actual={basis.total}
            goal={goalClicks}
            pace={pace}
            big
          />
          {goalByMedium &&
            Object.entries(goalByMedium)
              .sort((a, b) => b[1] - a[1])
              .map(([m, g]) => (
                <GoalRow key={m} label={m} actual={basis.byMedium[m] ?? 0} goal={g} pace={pace} />
              ))}
          {unassigned.length > 0 && (
            <p className="muted" style={{ fontSize: 11.5, margin: "8px 0 0" }}>
              {t("goalUnassigned", {
                list: unassigned.map(([m, n]) => `${m} ${n.toLocaleString()}`).join(" · "),
              })}
            </p>
          )}
          {pace !== null ? (
            (basis.total < goalClicks ||
              Object.entries(goalByMedium ?? {}).some(([m, g]) => (basis.byMedium[m] ?? 0) < g)) && (
            <p className="muted" style={{ fontSize: 11.5, margin: "8px 0 0" }}>
              <span className="goal-pace-key" /> {t("goalPaceLegend")}
            </p>
            )
          ) : (
            showPaceHint && (
              <p className="muted" style={{ fontSize: 11.5, margin: "8px 0 0" }}>
                {t("goalPaceHint")}
              </p>
            )
          )}
        </>
      )}
    </div>
  );
}

function GoalRow({
  label,
  actual,
  goal,
  pace,
  big = false,
  isTotal = false,
}: {
  label: string | null;
  actual: number;
  goal: number;
  pace: number | null;
  big?: boolean;
  /** The "total" row in a split goal — label rendered as text, not a channel pill. */
  isTotal?: boolean;
}) {
  const t = useTranslations("campaigns.detail");
  const pct = (actual / goal) * 100;
  const reached = actual >= goal;
  const expected = pace !== null ? Math.round(goal * pace) : null;
  const diff = expected !== null ? actual - expected : 0;
  const behind = expected !== null && !reached && diff < 0;
  const color = reached ? "var(--ok-fg)" : behind ? "var(--warn-fg)" : "var(--data-violet)";
  const pctText = pct < 10 ? pct.toFixed(1) : String(Math.round(pct));

  return (
    <div className={`goal-row ${big ? "goal-row-big" : ""}`}>
      {label !== null && (
        <div className="goal-row-label">
          {isTotal ? (
            <strong style={{ fontSize: 12.5, color: "var(--ink-200)" }}>{label}</strong>
          ) : (
            <span className="pill pill-medium" title={label}>
              {label}
            </span>
          )}
        </div>
      )}
      <div className="goal-row-main">
        <div className="goal-bar">
          <div className="goal-progress">
            <div
              style={{
                width: `${Math.min(pct, 100)}%`,
                ...(behind ? { background: "var(--data-amber)" } : {}),
                ...(reached ? { background: "var(--data-emerald)" } : {}),
              }}
            />
          </div>
          {!reached && pace !== null && pace > 0 && pace < 1 && (
            <div className="goal-pace" style={{ left: `${pace * 100}%` }} />
          )}
        </div>
        <div className="goal-row-meta">
          <span style={{ color, fontWeight: 500 }}>
            {reached ? `${t("goalReached")} ` : ""}
            {t("goalPct", { pct: pctText })}
            <span className="muted" style={{ fontWeight: 400 }}>
              {" "}
              · {actual.toLocaleString()} / {goal.toLocaleString()}
            </span>
          </span>
          {!reached &&
            (expected !== null && pace !== null && pace < 1 ? (
              <span style={{ color: behind ? "var(--warn-fg)" : "var(--ok-fg)" }}>
                {behind
                  ? t("goalBehind", { n: (-diff).toLocaleString() })
                  : t("goalAhead", { n: diff.toLocaleString() })}
                <span className="muted"> · {t("goalExpected", { n: expected.toLocaleString() })}</span>
              </span>
            ) : (
              <span className="muted">{t("clicksRemaining", { n: (goal - actual).toLocaleString() })}</span>
            ))}
        </div>
      </div>
    </div>
  );
}
