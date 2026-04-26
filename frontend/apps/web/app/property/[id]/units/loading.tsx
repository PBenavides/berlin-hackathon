export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg border bg-muted/30" />
        ))}
      </div>
      <div className="h-16 animate-pulse rounded-lg border bg-muted/30" />
      <div className="h-64 animate-pulse rounded-lg border bg-muted/30" />
    </div>
  );
}
