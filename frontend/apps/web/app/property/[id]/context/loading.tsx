export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-1/2 animate-pulse rounded bg-muted/40" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-32 animate-pulse rounded-lg border bg-muted/30" />
      ))}
    </div>
  );
}
