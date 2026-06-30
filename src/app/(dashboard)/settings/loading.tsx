export default function SettingsLoading() {
  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 space-y-2">
          <div className="h-7 w-28 animate-pulse rounded-lg bg-secondary" />
          <div className="h-4 w-64 animate-pulse rounded-lg bg-secondary" />
        </div>
        <div className="space-y-10">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="grid gap-8 md:grid-cols-[200px_1fr]">
              <div className="space-y-2">
                <div className="h-4 w-20 animate-pulse rounded bg-secondary" />
                <div className="h-3 w-36 animate-pulse rounded bg-secondary" />
              </div>
              <div className="h-48 animate-pulse rounded-xl bg-secondary" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}