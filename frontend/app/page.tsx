interface Property {
  id: string;
  name: string;
  slack_channel: string | null;
  created_at: string;
}

async function getProperties(): Promise<Property[]> {
  try {
    const res = await fetch("http://localhost:8000/api/v1/properties", {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function PropertyCard({ property }: { property: Property }) {
  const createdDate = new Date(property.created_at).toLocaleDateString("en-DE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="card p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg
            className="w-5 h-5 text-brand-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        </div>
        <span className="badge-blue">Active</span>
      </div>
      <h3 className="font-semibold text-slate-900 text-lg mb-1">{property.name}</h3>
      {property.slack_channel && (
        <p className="text-sm text-slate-500 mb-3 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
          </svg>
          {property.slack_channel}
        </p>
      )}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
        <span className="text-xs text-slate-400">Added {createdDate}</span>
        <div className="flex gap-2">
          <a
            href={`/api/v1/properties/${property.id}/context`}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
          >
            View Context
          </a>
          <span className="text-slate-300">·</span>
          <a
            href={`/api/v1/properties/${property.id}/policies`}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            Policies
          </a>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16 px-4">
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg
          className="w-8 h-8 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-700 mb-2">No properties yet</h3>
      <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
        The database is empty. Use the dev API to seed sample properties.
      </p>
      <div className="bg-slate-900 rounded-lg p-4 text-left max-w-md mx-auto">
        <p className="text-xs text-slate-400 font-mono mb-1"># Seed the database</p>
        <p className="text-sm text-green-400 font-mono">
          curl -X POST http://localhost:8000/api/v1/dev/reset
        </p>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const properties = await getProperties();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero section */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-50 border border-brand-200 rounded-full mb-4">
          <div className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" />
          <span className="text-xs font-medium text-brand-700">Human-in-the-loop</span>
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-3">
          Property Context Engine
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl">
          Versioned, human-curated property memory for AI operations. Every resolved ticket
          improves the next response.
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-10 max-w-lg">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{properties.length}</p>
          <p className="text-xs text-slate-500 mt-1">Properties</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">5</p>
          <p className="text-xs text-slate-500 mt-1">Templates</p>
        </div>
        <div className="card p-4 text-center">
          <div className="flex items-center justify-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <p className="text-sm font-semibold text-green-600">Online</p>
          </div>
          <p className="text-xs text-slate-500 mt-1">API Status</p>
        </div>
      </div>

      {/* Properties section */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Properties</h2>
        <a
          href="/api/docs"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
          Open API Docs
        </a>
      </div>

      {properties.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="mt-12 p-6 bg-slate-900 rounded-2xl">
        <h3 className="text-white font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 font-mono mb-2">Seed / Reset DB</p>
            <p className="text-sm text-green-400 font-mono break-all">
              POST /api/v1/dev/reset
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 font-mono mb-2">Simulate ticket</p>
            <p className="text-sm text-green-400 font-mono break-all">
              POST /api/v1/dev/simulate-ticket
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 font-mono mb-2">Health check</p>
            <p className="text-sm text-green-400 font-mono break-all">
              GET /api/v1/health
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
