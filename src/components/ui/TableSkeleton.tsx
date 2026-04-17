/**
 * Generic table skeleton used while link/campaign lists load.
 *
 * Takes the space of a real <table> so layout doesn't jump when
 * real data replaces it. Columns default to 5 to match the links table
 * (checkbox, link+QR, clicks, status, actions).
 */
export function TableSkeleton({
  rows = 6,
  columns = 5,
  showHeader = true,
}: {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}) {
  return (
    <div
      className="bg-white rounded-xl border border-slate-100 overflow-hidden"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading…</span>
      <div className="overflow-x-auto">
        <table className="w-full">
          {showHeader && (
            <thead>
              <tr className="border-b border-slate-100">
                {Array.from({ length: columns }).map((_, i) => (
                  <th key={i} className="px-4 py-3 text-left">
                    <div className="h-3 w-20 rounded bg-slate-100 animate-pulse" />
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r} className="border-b border-slate-50 last:border-0">
                {Array.from({ length: columns }).map((_, c) => (
                  <td key={c} className="px-4 py-4">
                    <div
                      className="h-3 rounded bg-slate-100 animate-pulse"
                      style={{
                        // Vary widths so it looks organic, not machine-perfect
                        width: `${55 + ((r + c) % 4) * 10}%`,
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Card grid skeleton — for dashboard and analytics stat-card layouts.
 */
export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-slate-100 p-5 space-y-3"
        >
          <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
          <div className="h-8 w-16 rounded bg-slate-200 animate-pulse" />
          <div className="h-2 w-32 rounded bg-slate-100 animate-pulse" />
        </div>
      ))}
    </div>
  );
}
