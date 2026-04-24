import { notFound } from "next/navigation";
import { SimulatePanel } from "../../../tickets/SimulatePanel";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Property {
  id: string;
  name: string;
  slack_channel: string | null;
}

interface Ticket {
  id: string;
  property_id: string;
  source: string;
  raised_by: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  proposal?: {
    id: string;
    risk_level: string;
    action_status: string;
  } | null;
}

async function getProperty(id: string): Promise<Property | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/properties/${id}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getTickets(propertyId: string): Promise<Ticket[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/properties/${propertyId}/tickets`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: "bg-amber-100 text-amber-700",
    proposed: "bg-blue-100 text-blue-700",
    approved: "bg-green-100 text-green-700",
    resolved: "bg-slate-100 text-slate-600",
    rejected: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
        styles[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  const styles: Record<string, string> = {
    low: "bg-green-100 text-green-700",
    medium: "bg-amber-100 text-amber-700",
    high: "bg-red-100 text-red-700",
    critical: "bg-red-200 text-red-900",
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
        styles[risk] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      ⚠ {risk}
    </span>
  );
}

export default async function PropertyTicketsPage({
  params,
}: {
  params: { id: string };
}) {
  const [property, tickets] = await Promise.all([
    getProperty(params.id),
    getTickets(params.id),
  ]);

  if (!property) notFound();

  const sortedTickets = [...tickets].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <a href="/" className="hover:text-slate-900 transition-colors">
          Properties
        </a>
        <span>/</span>
        <span className="text-slate-900 font-medium">{property.name}</span>
        <span>/</span>
        <span className="text-slate-600">Tickets</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{property.name}</h1>
          {property.slack_channel && (
            <p className="text-sm text-slate-500 mt-0.5">{property.slack_channel}</p>
          )}
        </div>
        <div className="flex gap-3">
          <a
            href={`/api/v1/properties/${property.id}/context`}
            target="_blank"
            className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
          >
            View Context →
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total", count: tickets.length, color: "text-slate-900" },
          { label: "Open", count: tickets.filter((t) => t.status === "open").length, color: "text-amber-600" },
          { label: "Proposed", count: tickets.filter((t) => t.status === "proposed").length, color: "text-blue-600" },
          { label: "Resolved", count: tickets.filter((t) => t.status === "resolved").length, color: "text-green-600" },
        ].map((s) => (
          <div key={s.label} className="card p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Simulate panel */}
      <SimulatePanel />

      {/* Tickets */}
      {sortedTickets.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500">No tickets for this property yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedTickets.map((ticket) => (
            <a
              key={ticket.id}
              href={`/tickets/${ticket.id}`}
              className="block card p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <StatusBadge status={ticket.status} />
                    {ticket.proposal && (
                      <RiskBadge risk={ticket.proposal.risk_level} />
                    )}
                  </div>
                  <h3 className="font-semibold text-slate-900 truncate">
                    {ticket.subject}
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">{ticket.raised_by}</p>
                  <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                    {ticket.body}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-slate-400">
                    {new Date(ticket.created_at).toLocaleDateString("en-DE", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  {ticket.proposal &&
                    ticket.proposal.action_status === "pending" && (
                      <p className="text-xs text-brand-600 mt-1">Review →</p>
                    )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
