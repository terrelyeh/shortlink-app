import { TableSkeleton } from "@/components/ui/TableSkeleton";

export default function LinksLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <span className="sr-only">Loading links…</span>

      {/* Header row: title + action buttons */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-32 rounded bg-slate-200 animate-pulse" />
          <div className="h-4 w-56 rounded bg-slate-100 animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-lg bg-slate-100 animate-pulse" />
          <div className="h-9 w-32 rounded-lg bg-slate-100 animate-pulse" />
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex gap-3">
        <div className="flex-1 h-10 rounded-lg bg-slate-100 animate-pulse" />
        <div className="h-10 w-40 rounded-lg bg-slate-100 animate-pulse" />
        <div className="h-10 w-48 rounded-lg bg-slate-100 animate-pulse" />
      </div>

      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}
