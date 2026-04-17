/**
 * Dashboard fallback skeleton — rendered INSTANTLY by Next.js on navigation,
 * before the route's JS bundle is downloaded/parsed. Every concrete page
 * below this layout can add its own loading.tsx to override with something
 * more tailored.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>

      {/* Page header placeholder */}
      <div className="space-y-2">
        <div className="h-7 w-48 rounded bg-slate-200 animate-pulse" />
        <div className="h-4 w-72 rounded bg-slate-100 animate-pulse" />
      </div>

      {/* Generic card block so the viewport never looks empty */}
      <div className="bg-white rounded-xl border border-slate-100 p-8 space-y-4">
        <div className="h-4 w-2/3 rounded bg-slate-100 animate-pulse" />
        <div className="h-4 w-1/2 rounded bg-slate-100 animate-pulse" />
        <div className="h-4 w-5/6 rounded bg-slate-100 animate-pulse" />
      </div>
    </div>
  );
}
