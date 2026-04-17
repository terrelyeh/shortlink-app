import { TableSkeleton } from "@/components/ui/TableSkeleton";

export default function CampaignsLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <span className="sr-only">Loading campaigns…</span>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded bg-slate-200 animate-pulse" />
          <div className="h-4 w-56 rounded bg-slate-100 animate-pulse" />
        </div>
        <div className="h-10 w-32 rounded-lg bg-slate-100 animate-pulse" />
      </div>

      <TableSkeleton rows={5} columns={5} />
    </div>
  );
}
