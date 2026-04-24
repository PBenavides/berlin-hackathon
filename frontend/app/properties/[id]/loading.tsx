export default function PropertyPageLoading() {
  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="h-7 w-56 bg-slate-200 rounded animate-pulse mb-2" />
        <div className="h-4 w-80 bg-slate-100 rounded animate-pulse" />
      </div>
      <div className="px-6 py-6 space-y-4 max-w-3xl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-5 space-y-3">
            <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
