import { AuditClient } from "./AuditClient";

const API_BASE = process.env.BACKEND_URL || "http://localhost:8000";

interface Property {
  id: string;
  name: string;
}

async function getProperties(): Promise<Property[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/properties`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { property_id?: string };
}) {
  const properties = await getProperties();

  return (
    <div className="min-h-full">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Audit Log</h1>
            <p className="text-sm text-slate-500">
              Chronological record of all system and operator actions
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { label: "ticket.create", color: "bg-blue-100 text-blue-700" },
            { label: "proposal.create", color: "bg-purple-100 text-purple-700" },
            { label: "proposal.action.*", color: "bg-green-100 text-green-700" },
            { label: "proposal.memory.*", color: "bg-emerald-100 text-emerald-700" },
            { label: "context.write", color: "bg-amber-100 text-amber-700" },
          ].map((item) => (
            <span
              key={item.label}
              className={`text-xs font-mono px-2 py-0.5 rounded-full ${item.color}`}
            >
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        <AuditClient
          initialPropertyId={searchParams.property_id ?? ""}
          properties={properties}
        />
      </div>
    </div>
  );
}
