export default function ContextPageLoading() {
  return (
    <div className="min-h-full">
      {/* Header skeleton */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex gap-2 mb-3">
          <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-4 bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="flex items-center justify-between">
          <div className="h-7 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="h-8 w-24 bg-slate-100 rounded-lg animate-pulse" />
        </div>
      </div>

      <div className="flex gap-0">
        {/* Main content skeleton */}
        <div className="flex-1 px-6 py-6 max-w-3xl space-y-4">
          {/* Version badge + metadata */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-12 bg-brand-100 rounded-full animate-pulse" />
              <div className="h-5 w-16 bg-green-100 rounded-full animate-pulse" />
            </div>
            <div className="text-right space-y-1">
              <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
              <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
            </div>
          </div>

          {/* Content card skeleton */}
          <div className="card p-6 space-y-3">
            {/* Heading */}
            <div className="h-6 w-1/3 bg-slate-200 rounded animate-pulse mb-4" />
            {/* Paragraphs */}
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div
                key={i}
                className="h-4 bg-slate-100 rounded animate-pulse"
                style={{ width: `${55 + (i % 4) * 12}%` }}
              />
            ))}
            {/* Second section */}
            <div className="h-5 w-1/4 bg-slate-200 rounded animate-pulse mt-6 mb-2" />
            {[1, 2, 3].map((i) => (
              <div
                key={`b${i}`}
                className="h-4 bg-slate-100 rounded animate-pulse"
                style={{ width: `${65 + (i % 3) * 8}%` }}
              />
            ))}
          </div>
        </div>

        {/* Right sidebar skeleton */}
        <div className="w-64 flex-shrink-0 border-l border-slate-200 bg-white px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="h-4 w-28 bg-slate-100 rounded animate-pulse" />
            <div className="h-5 w-6 bg-slate-200 rounded-full animate-pulse" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="mb-3 rounded-lg border border-slate-100 p-3 space-y-2">
              <div className="flex justify-between">
                <div className="h-4 w-8 bg-slate-200 rounded animate-pulse" />
              </div>
              <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
              <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
