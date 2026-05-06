"use client";

/**
 * Click heatmap — 7 day-of-week rows × 24 hour columns, intensity
 * shaded by click count. Marketers use this to find best send time
 * for EDM / social posts based on historical click patterns.
 *
 * Pure CSS grid (no recharts). Bucketing happens in compute.ts via
 * `new Date(timestamp).getDay()/.getHours()`, which uses the JS
 * runtime's local timezone — i.e. the **viewer's browser timezone**.
 * Single-region teams (everyone in Taipei) see consistent buckets;
 * a teammate viewing from another TZ would see clicks bucketed in
 * their own local hours. Acceptable trade-off for an internal tool.
 */

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface DayHourHeatmapProps {
  /** [day-0..6][hour-0..23] of click counts. */
  data: number[][];
}

export function DayHourHeatmap({ data }: DayHourHeatmapProps) {
  const max = Math.max(0, ...data.flat());

  if (max === 0) {
    return (
      <div
        style={{
          height: 200,
          display: "grid",
          placeItems: "center",
          color: "var(--ink-500)",
          fontSize: 13,
        }}
      >
        —
      </div>
    );
  }

  const intensity = (n: number) => {
    if (n === 0) return 0;
    // Non-linear scale so a single click is still visible against the
    // max — pure n/max collapses small values to invisible.
    return Math.min(0.15 + (n / max) * 0.85, 1);
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "32px repeat(24, minmax(20px, 1fr))",
          gap: 2,
          fontSize: 10,
          minWidth: 560,
        }}
      >
        {/* Header row: hours 0..23 */}
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={h}
            style={{
              textAlign: "center",
              color: "var(--ink-500)",
              fontVariantNumeric: "tabular-nums",
              padding: "0 0 4px",
              // Show every 3rd label to avoid clutter
              visibility: h % 3 === 0 ? "visible" : "hidden",
            }}
          >
            {h}
          </div>
        ))}

        {/* 7 day rows */}
        {DAY_LABELS.map((day, di) => (
          <FragmentRow key={day} label={day} row={data[di]} intensity={intensity} />
        ))}
      </div>

      {/* Legend + viewer-TZ disclosure so users understand bucketing
          uses their own browser timezone, not server / UTC. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginTop: 12,
          fontSize: 11,
          color: "var(--ink-500)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span>Less</span>
          {[0.1, 0.3, 0.5, 0.75, 1].map((i) => (
            <div
              key={i}
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: `rgba(3, 169, 244, ${i})`,
              }}
            />
          ))}
          <span>More · max {max}/h</span>
        </div>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          Times in {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </span>
      </div>
    </div>
  );
}

function FragmentRow({
  label,
  row,
  intensity,
}: {
  label: string;
  row: number[];
  intensity: (n: number) => number;
}) {
  return (
    <>
      <div
        style={{
          color: "var(--ink-400)",
          padding: "0 6px",
          display: "flex",
          alignItems: "center",
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      {row.map((n, h) => (
        <div
          key={h}
          title={`${label} ${h}:00 — ${n} click${n === 1 ? "" : "s"}`}
          style={{
            height: 22,
            borderRadius: 3,
            background:
              n === 0
                ? "var(--bg-subtle)"
                : `rgba(3, 169, 244, ${intensity(n)})`,
            cursor: "default",
          }}
        />
      ))}
    </>
  );
}
