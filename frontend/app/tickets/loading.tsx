export default function TicketsLoading() {
  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="h-7 w-32 bg-slate-200 rounded animate-pulse mb-2" />
        <div className="h-4 w-80 bg-slate-100 rounded animate-pulse" />
      </div>
      <div className="px-6 py-6 max-w-4xl">
        <div className="grid grid-cols-3 gap-4 mb-6 max-w-sm">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 text-center">
              <div className="h-8 w-10 bg-slate-200 rounded animate-pulse mx-auto mb-2" />
              <div className="h-3 w-12 bg-slate-100 rounded animate-pulse mx-auto" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <div className="h-5 w-16 bg-slate-200 rounded-full animate-pulse" />
                    <div className="h-5 w-12 bg-slate-100 rounded-full animate-pulse" />
                  </div>
                  <div className="h-5 w-3/4 bg-slate-200 rounded animate-pulse" />
                  <div className="h-4 w-1/2 bg-slate-100 rounded animate-pulse" />
                </div>
                <div className="h-4 w-16 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
