export default function TicketDetailLoading() {
  return (
    <div className="min-h-full">
      {/* Header skeleton */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex gap-2 mb-3">
          <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-4 bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-36 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-20 bg-slate-200 rounded-full animate-pulse" />
          <div className="h-6 w-24 bg-slate-200 rounded-lg animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        {/* Left column skeleton */}
        <div className="lg:col-span-1 border-r border-slate-200 px-5 py-6 space-y-4 bg-slate-50">
          <div className="card p-5 space-y-3">
            <div className="h-6 w-3/4 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-slate-100 rounded animate-pulse" />
            <div className="h-4 w-2/3 bg-slate-100 rounded animate-pulse" />
            <div className="border-t border-slate-100 pt-4 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-3 bg-slate-100 rounded animate-pulse" style={{ width: `${70 + i * 5}%` }} />
              ))}
            </div>
          </div>
          <div className="card p-5 space-y-3">
            <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
            <div className="flex justify-between">
              <div className="h-4 w-16 bg-slate-100 rounded animate-pulse" />
              <div className="h-5 w-20 bg-slate-200 rounded-full animate-pulse" />
            </div>
            <div className="flex justify-between">
              <div className="h-4 w-16 bg-slate-100 rounded animate-pulse" />
              <div className="h-5 w-20 bg-slate-200 rounded-full animate-pulse" />
            </div>
          </div>
        </div>

        {/* Right column skeleton */}
        <div className="lg:col-span-2 px-6 py-6 space-y-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 bg-slate-200 rounded animate-pulse" />
                <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
              </div>
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${60 + j * 10}%` }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
