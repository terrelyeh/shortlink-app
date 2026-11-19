/**
 * Tiny inline area chart for table cells. Any length of values; scales to
 * the row's own max unless `max` is given (pass a shared max to make rows
 * comparable with each other).
 */
export function MiniSpark({
  values,
  max,
  width = 96,
  height = 24,
  color = "var(--brand-500)",
  title,
}: {
  values: number[];
  max?: number;
  width?: number;
  height?: number;
  color?: string;
  title?: string;
}) {
  if (values.length === 0) return null;
  const top = Math.max(1, max ?? Math.max(...values));
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const pts = values.map((v, i) => {
    const x = values.length > 1 ? i * step : width / 2;
    const y = height - 1 - (Math.min(v, top) / top) * (height - 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const area = `0,${height} ${pts.join(" ")} ${width},${height}`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={title}
      style={{ display: "block", overflow: "visible" }}
    >
      {title && <title>{title}</title>}
      <polygon points={area} fill={color} opacity={0.12} />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}
