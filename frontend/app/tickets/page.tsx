import { SimulatePanel } from "./SimulatePanel";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Property {
  id: string;
  name: string;
}

interface TicketWithProposal {
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
    memory_status: string;
  } | null;
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

async function getPropertyTickets(
  propertyId: string
): Promise<TicketWithProposal[]> {
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
    edited: "bg-purple-100 text-purple-700",
    resolved: "bg-slate-100 text-slate-600",
    rejected: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
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
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        styles[risk] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      ⚠ {risk}
    </span>
  );
}

function TicketRow({
  ticket,
  propertyName,
}: {
  ticket: TicketWithProposal;
  propertyName: string;
}) {
  const date = new Date(ticket.created_at).toLocaleDateString("en-DE", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <a
      href={`/tickets/${ticket.id}`}
      className="block card p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <StatusBadge status={ticket.status} />
            {ticket.proposal && (
              <RiskBadge risk={ticket.proposal.risk_level} />
            )}
          </div>
          <h3 className="font-semibold text-slate-900 truncate">
            {ticket.subject}
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            {ticket.raised_by}
            <span className="mx-1.5 text-slate-300">·</span>
            {propertyName}
          </p>
          <p className="text-sm text-slate-400 mt-1 line-clamp-2">
            {ticket.body}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-slate-400">{date}</p>
          {ticket.proposal && (
            <p className="text-xs text-brand-600 mt-1 font-medium">
              {ticket.proposal.action_status === "pending"
                ? "Awaiting review →"
                : ticket.proposal.action_status}
            </p>
          )}
        </div>
      </div>
    </a>
  );
}

export default async function TicketsPage() {
  const properties = await getProperties();

  const ticketsByProperty = await Promise.all(
    properties.map(async (p) => ({
      property: p,
      tickets: await getPropertyTickets(p.id),
    }))
  );

  const allTickets = ticketsByProperty
    .flatMap(({ property, tickets }) =>
      tickets.map((t) => ({ ticket: t, propertyName: property.name }))
    )
    .sort(
      (a, b) =>
        new Date(b.ticket.created_at).getTime() -
        new Date(a.ticket.created_at).getTime()
    );

  const openCount = allTickets.filter((t) => t.ticket.status === "open").length;
  const proposedCount = allTickets.filter(
    (t) => t.ticket.status === "proposed"
  ).length;
  const resolvedCount = allTickets.filter(
    (t) => t.ticket.status === "resolved"
  ).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Ticket Inbox
        </h1>
        <p className="text-slate-500">
          Support tickets across all properties — each triggers an AI proposal
          for human review.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8 max-w-sm">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{openCount}</p>
          <p className="text-xs text-slate-500 mt-1">Open</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{proposedCount}</p>
          <p className="text-xs text-slate-500 mt-1">Proposed</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{resolvedCount}</p>
          <p className="text-xs text-slate-500 mt-1">Resolved</p>
        </div>
      </div>

      {/* Simulate panel */}
      <SimulatePanel />

      {/* Ticket list */}
      {allTickets.length === 0 ? (
        <div className="text-center py-16">
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            No tickets yet
          </h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto">
            Use the panel above to simulate a ticket and watch the AI generate a
            proposal instantly.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {allTickets.map(({ ticket, propertyName }) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              propertyName={propertyName}
            />
          ))}
        </div>
      )}
    </div>
  );
}
