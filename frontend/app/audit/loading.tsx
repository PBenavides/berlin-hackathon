export default function AuditLoading() {
  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 bg-slate-100 rounded-lg animate-pulse" />
          <div>
            <div className="h-6 w-28 bg-slate-200 rounded animate-pulse mb-1.5" />
            <div className="h-4 w-56 bg-slate-100 rounded animate-pulse" />
          </div>
        </div>
      </div>
      <div className="px-6 py-6">
        <div className="flex gap-3 mb-5">
          <div className="h-9 w-36 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-9 w-44 bg-slate-200 rounded-lg animate-pulse" />
        </div>
        <div className="card overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex gap-4">
            {[80, 60, 100, 80, 120].map((w, i) => (
              <div key={i} className={`h-4 bg-slate-200 rounded animate-pulse`} style={{ width: w }} />
            ))}
          </div>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="px-4 py-3 border-b border-slate-100 flex gap-4">
              <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
              <div className="h-4 w-16 bg-slate-100 rounded animate-pulse" />
              <div className="h-5 w-32 bg-slate-200 rounded-full animate-pulse" />
              <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
