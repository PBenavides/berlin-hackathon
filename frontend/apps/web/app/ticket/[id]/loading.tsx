export default function Loading() {
  return (
    <div className="p-8">
      <div className="mb-6 h-12 w-2/3 animate-pulse rounded-lg bg-muted/40" />
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="h-64 animate-pulse rounded-lg border bg-muted/30" />
          <div className="h-32 animate-pulse rounded-lg border bg-muted/30" />
        </div>
        <aside className="space-y-4">
          <div className="h-32 animate-pulse rounded-lg border bg-muted/30" />
          <div className="h-32 animate-pulse rounded-lg border bg-muted/30" />
        </aside>
      </div>
    </div>
  );
}
