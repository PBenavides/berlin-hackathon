"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  property_id: string | null;
  entity_type: string;
  entity_id: string | null;
  event_metadata: Record<string, unknown> | null;
  created_at: string;
}

interface AuditListResponse {
  items: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

const ACTION_TYPES = [
  { value: "", label: "All Actions" },
  { value: "ticket.create", label: "ticket.create" },
  { value: "proposal.create", label: "proposal.create" },
  { value: "proposal.action.approve", label: "proposal.action.approve" },
  { value: "proposal.action.edit", label: "proposal.action.edit" },
  { value: "proposal.action.reject", label: "proposal.action.reject" },
  { value: "proposal.memory.approve", label: "proposal.memory.approve" },
  { value: "proposal.memory.edit", label: "proposal.memory.edit" },
  { value: "proposal.memory.reject", label: "proposal.memory.reject" },
  { value: "context.read", label: "context.read" },
  { value: "context.write", label: "context.write" },
  { value: "slack.notification.sent", label: "slack.notification.sent" },
  { value: "slack.notification.failed", label: "slack.notification.failed" },
];

const ACTION_COLORS: Record<string, string> = {
  "ticket.create": "bg-blue-100 text-blue-700 border-blue-200",
  "proposal.create": "bg-purple-100 text-purple-700 border-purple-200",
  "proposal.action.approve": "bg-green-100 text-green-700 border-green-200",
  "proposal.action.edit": "bg-indigo-100 text-indigo-700 border-indigo-200",
  "proposal.action.reject": "bg-red-100 text-red-700 border-red-200",
  "proposal.memory.approve": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "proposal.memory.edit": "bg-teal-100 text-teal-700 border-teal-200",
  "proposal.memory.reject": "bg-orange-100 text-orange-700 border-orange-200",
  "context.read": "bg-slate-100 text-slate-600 border-slate-200",
  "context.write": "bg-amber-100 text-amber-700 border-amber-200",
  "slack.notification.sent": "bg-sky-100 text-sky-700 border-sky-200",
  "slack.notification.failed": "bg-red-100 text-red-700 border-red-200",
};

const ACTOR_ICONS: Record<string, string> = {
  pipeline: "⚙",
  operator: "👤",
  "dev-simulator": "🎯",
  system: "🤖",
};

function EntityLink({
  entityType,
  entityId,
  metadata,
  propertyId,
}: {
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  propertyId: string | null;
}) {
  if (!entityId) return <span className="text-slate-400">—</span>;

  const short = entityId.slice(0, 8) + "…";

  if (entityType === "ticket") {
    const ticketId = entityId || (metadata?.ticket_id as string);
    return (
      <Link
        href={`/tickets/${ticketId}`}
        className="text-brand-600 hover:underline font-mono text-xs"
        title={entityId}
      >
        ticket/{short}
      </Link>
    );
  }

  if (entityType === "agent_proposal") {
    const ticketId = metadata?.ticket_id as string | undefined;
    if (ticketId) {
      return (
        <Link
          href={`/tickets/${ticketId}`}
          className="text-purple-600 hover:underline font-mono text-xs"
          title={entityId}
        >
          proposal/{short}
        </Link>
      );
    }
    return (
      <span className="font-mono text-xs text-slate-500" title={entityId}>
        proposal/{short}
      </span>
    );
  }

  if (entityType === "context_version" && propertyId) {
    const versionNum = (metadata as Record<string, unknown>)?.to_version ??
                        (metadata as Record<string, unknown>)?.context_version;
    return (
      <Link
        href={`/properties/${propertyId}/context${versionNum ? `?version=${versionNum}` : ""}`}
        className="text-amber-700 hover:underline font-mono text-xs"
        title={entityId}
      >
        context/{versionNum ? `v${versionNum}` : short}
      </Link>
    );
  }

  return (
    <span className="font-mono text-xs text-slate-500" title={entityId}>
      {entityType}/{short}
    </span>
  );
}

interface AuditClientProps {
  initialPropertyId?: string;
  properties: Array<{ id: string; name: string }>;
}

export function AuditClient({ initialPropertyId, properties }: AuditClientProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPropertyId, setSelectedPropertyId] = useState(initialPropertyId ?? "");
  const [selectedAction, setSelectedAction] = useState("");
  const [offset, setOffset] = useState(0);
  const LIMIT = 30;

  const fetchAudit = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(offset),
      });
      if (selectedPropertyId) params.set("property_id", selectedPropertyId);
      if (selectedAction) params.set("action", selectedAction);

      const res = await fetch(`${API_BASE}/api/v1/audit?${params}`);
      if (!res.ok) throw new Error("Failed to fetch audit log");
      const data: AuditListResponse = await res.json();
      setEntries(data.items);
      setTotal(data.total);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPropertyId, selectedAction, offset]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  // Reset to page 0 when filters change
  function applyPropertyFilter(val: string) {
    setSelectedPropertyId(val);
    setOffset(0);
  }
  function applyActionFilter(val: string) {
    setSelectedAction(val);
    setOffset(0);
  }

  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        {/* Property filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Property:</label>
          <select
            value={selectedPropertyId}
            onChange={(e) => applyPropertyFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-700"
          >
            <option value="">All Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Action type filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Action:</label>
          <select
            value={selectedAction}
            onChange={(e) => applyActionFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-700 font-mono"
          >
            {ACTION_TYPES.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        {/* Stats */}
        <div className="ml-auto flex items-center gap-2">
          {isLoading ? (
            <span className="text-xs text-slate-400 animate-pulse">Loading…</span>
          ) : (
            <span className="text-xs text-slate-500">
              {total} event{total !== 1 ? "s" : ""}
              {(selectedPropertyId || selectedAction) && " (filtered)"}
            </span>
          )}
          <button
            onClick={() => fetchAudit()}
            disabled={isLoading}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1 disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading && entries.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium">No audit events found</p>
            <p className="text-sm text-slate-400 mt-1">
              {selectedPropertyId || selectedAction
                ? "Try clearing the filters above"
                : "Events will appear here as tickets are processed"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Actor
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Entity
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry) => {
                  const ts = new Date(entry.created_at);
                  const timeStr = ts.toLocaleTimeString("en-DE", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });
                  const dateStr = ts.toLocaleDateString("en-DE", {
                    month: "short",
                    day: "numeric",
                  });

                  const actorIcon = ACTOR_ICONS[entry.actor] ?? "●";
                  const actionColor = ACTION_COLORS[entry.action] ?? "bg-slate-100 text-slate-600 border-slate-200";

                  // Extract key details from metadata
                  const meta = entry.event_metadata ?? {};
                  const details: string[] = [];
                  if (meta.risk_level) details.push(`risk: ${meta.risk_level}`);
                  if (meta.from_version && meta.to_version)
                    details.push(`v${meta.from_version} → v${meta.to_version}`);
                  if (meta.decision) details.push(`decision: ${meta.decision}`);
                  if (meta.context_version) details.push(`v${meta.context_version}`);
                  if (meta.reason && typeof meta.reason === "string")
                    details.push(meta.reason.slice(0, 40));

                  const propertyName = entry.property_id
                    ? properties.find((p) => p.id === entry.property_id)?.name
                    : null;

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                      {/* Timestamp */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-xs font-mono text-slate-700">{timeStr}</p>
                        <p className="text-xs text-slate-400">{dateStr}</p>
                      </td>

                      {/* Actor */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{actorIcon}</span>
                          <span className="text-xs font-medium text-slate-700">{entry.actor}</span>
                        </div>
                        {propertyName && (
                          <p className="text-xs text-slate-400 mt-0.5 ml-6">{propertyName}</p>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-medium border ${actionColor}`}
                        >
                          {entry.action}
                        </span>
                      </td>

                      {/* Entity */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <EntityLink
                            entityType={entry.entity_type}
                            entityId={entry.entity_id}
                            metadata={entry.event_metadata}
                            propertyId={entry.property_id}
                          />
                          <span className="text-xs text-slate-400">{entry.entity_type}</span>
                        </div>
                      </td>

                      {/* Details */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {details.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {details.map((d, i) => (
                              <span
                                key={i}
                                className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded"
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-500">
            Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              disabled={offset === 0}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Previous
            </button>
            <span className="px-3 py-1.5 text-sm text-slate-500">
              Page {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setOffset(offset + LIMIT)}
              disabled={offset + LIMIT >= total}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
