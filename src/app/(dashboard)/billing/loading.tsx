export default function BillingLoading() {
  return (
    <div className="p-8">
      <div className="mb-8 space-y-2">
        <div className="h-7 w-20 animate-pulse rounded-lg bg-secondary" />
        <div className="h-4 w-52 animate-pulse rounded-lg bg-secondary" />
      </div>
      <div className="max-w-2xl space-y-4">
        <div className="h-64 animate-pulse rounded-xl bg-secondary" />
        <div className="h-48 animate-pulse rounded-xl bg-secondary" />
      </div>
    </div>
  );
}