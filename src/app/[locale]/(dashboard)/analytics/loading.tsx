import { CardGridSkeleton } from "@/components/ui/TableSkeleton";

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <span className="sr-only">Loading analytics…</span>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded bg-slate-200 animate-pulse" />
          <div className="h-4 w-64 rounded bg-slate-100 animate-pulse" />
        </div>
        <div className="h-10 w-48 rounded-lg bg-slate-100 animate-pulse" />
      </div>

      <CardGridSkeleton count={4} />

      {/* Main chart */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-32 rounded bg-slate-200 animate-pulse" />
          <div className="h-4 w-24 rounded bg-slate-100 animate-pulse" />
        </div>
        <div className="h-64 rounded-lg bg-slate-100 animate-pulse" />
      </div>

      {/* Breakdown panels (UTM / geo / device) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-slate-100 p-6 space-y-3"
          >
            <div className="h-5 w-28 rounded bg-slate-200 animate-pulse" />
            {[0, 1, 2, 3, 4].map((j) => (
              <div key={j} className="flex items-center justify-between gap-4">
                <div className="h-3 w-1/3 rounded bg-slate-100 animate-pulse" />
                <div className="h-2 flex-1 rounded-full bg-slate-100 animate-pulse" />
                <div className="h-3 w-10 rounded bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
