export default function DashboardLoading() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 animate-pulse rounded-lg bg-secondary" />
          <div className="h-4 w-48 animate-pulse rounded-lg bg-secondary" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-52 animate-pulse rounded-lg bg-secondary" />
          <div className="h-9 w-36 animate-pulse rounded-lg bg-secondary" />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="aspect-video animate-pulse bg-secondary" />
            <div className="space-y-2 p-3">
              <div className="h-4 w-3/4 animate-pulse rounded bg-secondary" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-secondary" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}