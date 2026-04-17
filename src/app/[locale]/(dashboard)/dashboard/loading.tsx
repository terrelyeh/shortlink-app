import { CardGridSkeleton, TableSkeleton } from "@/components/ui/TableSkeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <span className="sr-only">Loading dashboard…</span>

      <div className="space-y-2">
        <div className="h-7 w-40 rounded bg-slate-200 animate-pulse" />
        <div className="h-4 w-64 rounded bg-slate-100 animate-pulse" />
      </div>

      {/* Stat cards (clicks, conversions, etc.) */}
      <CardGridSkeleton count={4} />

      {/* Chart area */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-4">
        <div className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
        <div className="h-56 rounded-lg bg-slate-100 animate-pulse" />
      </div>

      {/* Recent activity table */}
      <TableSkeleton rows={5} columns={4} />
    </div>
  );
}
