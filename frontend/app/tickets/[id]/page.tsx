import { notFound } from "next/navigation";
import Link from "next/link";
import { ProposalReview } from "./ProposalReview";

const API_BASE = process.env.BACKEND_URL || "http://localhost:8000";

interface Proposal {
  id: string;
  ticket_id: string;
  context_version_id: string | null;
  proposed_external_action: {
    type: string;
    summary: string;
    steps?: string[];
    draft_message?: string | null;
  };
  context_delta: {
    learned_facts: string[];
    conflicts: Array<{
      heading: string;
      conflict: string;
      severity: string;
    }>;
    missing_info: string[];
    risk_label: string;
    suggested_context_update: string | null;
  };
  reasoning: string;
  citations: Array<{
    heading: string;
    excerpt: string;
    relevance: string;
  }>;
  policy_evaluation: {
    matched_policies: Array<{
      kind: string;
      description: string;
      effect: string;
      violated: boolean;
    }>;
    violations: Array<unknown>;
    recommendation: string;
    summary: string;
  };
  risk_level: string;
  confidence: number | null;
  action_status: string;
  memory_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  final_external_action: unknown | null;
  final_context_update_md: string | null;
  rejection_reason: string | null;
  created_at: string;
}

interface TicketDetail {
  id: string;
  property_id: string;
  source: string;
  raised_by: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  proposal?: Proposal | null;
}

interface ContextVersion {
  id: string;
  version: number;
  created_by: string;
  created_at: string;
}

async function getTicket(id: string): Promise<TicketDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/tickets/${id}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getContextVersion(
  propertyId: string,
  versionId: string
): Promise<ContextVersion | null> {
  try {
    // Fetch all versions and find the one matching the ID
    const res = await fetch(
      `${API_BASE}/api/v1/properties/${propertyId}/context/versions`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const versions: ContextVersion[] = await res.json();
    return versions.find((v) => v.id === versionId) ?? null;
  } catch {
    return null;
  }
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: "bg-amber-100 text-amber-700",
    proposed: "bg-blue-100 text-blue-700",
    approved: "bg-green-100 text-green-700",
    resolved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        styles[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status.toUpperCase()}
    </span>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  const styles: Record<string, string> = {
    low: "bg-green-100 text-green-700 border-green-200",
    medium: "bg-amber-100 text-amber-700 border-amber-200",
    high: "bg-red-100 text-red-700 border-red-200",
    critical: "bg-red-200 text-red-900 border-red-400",
  };
  const icons: Record<string, string> = {
    low: "✓",
    medium: "⚡",
    high: "⚠️",
    critical: "🚨",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-semibold border ${
        styles[risk] ?? "bg-slate-100 text-slate-700 border-slate-200"
      }`}
    >
      {icons[risk] ?? "⚠"}
      {risk.toUpperCase()} RISK
    </span>
  );
}

function EffectBadge({ effect }: { effect: string }) {
  const lc = effect.toLowerCase();
  let cls = "bg-slate-100 text-slate-600";
  if (lc.includes("allow")) cls = "bg-green-100 text-green-700";
  else if (lc.includes("warn") || lc.includes("require")) cls = "bg-amber-100 text-amber-700";
  else if (lc.includes("block") || lc.includes("deny")) cls = "bg-red-100 text-red-700";

  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wide ${cls}`}>
      {effect}
    </span>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-slate-700 w-10 text-right">
        {pct}%
      </span>
    </div>
  );
}

export default async function TicketDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const ticket = await getTicket(params.id);
  if (!ticket) notFound();

  const proposal = ticket.proposal;

  // Look up the context version that was used when generating the proposal
  let usedContextVersion: ContextVersion | null = null;
  if (proposal?.context_version_id && ticket.property_id) {
    usedContextVersion = await getContextVersion(
      ticket.property_id,
      proposal.context_version_id
    );
  }

  const createdAt = new Date(ticket.created_at).toLocaleString("en-DE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-full">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <nav className="flex items-center gap-2 text-sm text-slate-500 mb-3">
          <Link href="/tickets" className="hover:text-slate-900 transition-colors">
            All Tickets
          </Link>
          <span>/</span>
          {ticket.property_id && (
            <>
              <Link
                href={`/properties/${ticket.property_id}/tickets`}
                className="hover:text-slate-900 transition-colors"
              >
                Property Tickets
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-slate-900 font-medium truncate">{ticket.subject}</span>
        </nav>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={ticket.status} />
            {proposal && <RiskBadge risk={proposal.risk_level} />}
            <span className="text-xs text-slate-400">{createdAt}</span>
          </div>
          {/* Quick links for resolved tickets */}
          {ticket.status === "resolved" && ticket.property_id && (
            <div className="flex items-center gap-3 flex-wrap">
              <Link
                href={`/properties/${ticket.property_id}/context?showDiff=1`}
                className="text-xs font-medium text-amber-600 hover:text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
              >
                ↕ View context diff
              </Link>
              <Link
                href={`/audit?property_id=${ticket.property_id}`}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
              >
                📋 Audit trail
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        {/* Left: Ticket info (1/3) */}
        <div className="lg:col-span-1 border-r border-slate-200 px-5 py-6 space-y-4 bg-slate-50">
          {/* Original ticket */}
          <div className="card p-5">
            <h2 className="text-base font-bold text-slate-900 mb-3">
              {ticket.subject}
            </h2>
            <div className="text-xs text-slate-500 space-y-1 mb-4">
              <p>
                <span className="font-medium text-slate-600">From:</span>{" "}
                {ticket.raised_by}
              </p>
              <p>
                <span className="font-medium text-slate-600">Source:</span>{" "}
                {ticket.source}
              </p>
            </div>
            <div className="border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {ticket.body}
              </p>
            </div>
          </div>

          {/* Proposal metadata */}
          {proposal && (
            <div className="card p-5">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Proposal Status
              </h3>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Action</span>
                  <StatusBadge status={proposal.action_status} />
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Memory</span>
                  <StatusBadge status={proposal.memory_status} />
                </div>
                {proposal.confidence !== null && (
                  <div className="pt-1">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>AI Confidence</span>
                    </div>
                    <ConfidenceBar confidence={proposal.confidence as number} />
                  </div>
                )}
                {proposal.reviewed_by && (
                  <div className="flex justify-between items-center text-sm pt-1 border-t border-slate-100">
                    <span className="text-slate-500">Reviewed by</span>
                    <span className="font-medium text-slate-800">
                      {proposal.reviewed_by}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Context version info */}
          {usedContextVersion && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Context Snapshot Used
              </h3>
              <div className="flex items-center gap-2">
                <span className="bg-brand-50 border border-brand-200 text-brand-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  v{usedContextVersion.version}
                </span>
                <span className="text-xs text-slate-500">
                  by {usedContextVersion.created_by}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {new Date(usedContextVersion.created_at).toLocaleDateString("en-DE", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
              <Link
                href={`/properties/${ticket.property_id}/context?version=${usedContextVersion.version}`}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium mt-2 inline-block"
              >
                View context snapshot →
              </Link>
            </div>
          )}
        </div>

        {/* Right: Proposal detail (2/3) */}
        <div className="lg:col-span-2 px-6 py-6 space-y-5">
          {!proposal ? (
            <div className="card p-12 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg
                  className="w-6 h-6 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="text-slate-600 font-medium">Proposal generation pending</p>
              <p className="text-sm text-slate-400 mt-1">
                The AI is generating a proposal for this ticket.
              </p>
            </div>
          ) : (
            <>
              {/* AI Reasoning / Overview */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 bg-brand-100 text-brand-600 rounded flex items-center justify-center text-xs font-bold">
                      AI
                    </span>
                    AI Proposal
                  </h2>
                  <RiskBadge risk={proposal.risk_level} />
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {proposal.reasoning}
                </p>
              </div>

              {/* 1. External action */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <span className="w-5 h-5 bg-brand-100 text-brand-600 rounded flex items-center justify-center text-xs font-bold">
                    1
                  </span>
                  Proposed External Action
                </h3>

                {/* Action type + title */}
                <div className="flex items-start gap-2 mb-3">
                  {proposal.proposed_external_action.type && (
                    <span className="flex-shrink-0 text-xs font-semibold bg-slate-900 text-slate-200 px-2.5 py-1 rounded-lg uppercase tracking-wide">
                      {proposal.proposed_external_action.type}
                    </span>
                  )}
                  {(proposal.proposed_external_action as Record<string, unknown>).title && (
                    <span className="text-sm font-semibold text-slate-900 leading-tight">
                      {String((proposal.proposed_external_action as Record<string, unknown>).title)}
                    </span>
                  )}
                </div>

                <p className="text-sm text-slate-700 leading-relaxed mb-4 bg-slate-50 rounded-lg px-3 py-2">
                  {proposal.proposed_external_action.summary}
                </p>

                {proposal.proposed_external_action.steps &&
                  proposal.proposed_external_action.steps.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                        Steps
                      </p>
                      <ol className="space-y-1.5">
                        {proposal.proposed_external_action.steps.map(
                          (step, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2.5 text-sm text-slate-700"
                            >
                              <span className="flex-shrink-0 w-5 h-5 bg-brand-50 border border-brand-200 text-brand-600 rounded text-xs font-medium flex items-center justify-center mt-0.5">
                                {i + 1}
                              </span>
                              {step}
                            </li>
                          )
                        )}
                      </ol>
                    </div>
                  )}

                {proposal.proposed_external_action.draft_message && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                      Draft Message
                    </p>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                        {proposal.proposed_external_action.draft_message}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Context Delta */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <span className="w-5 h-5 bg-brand-100 text-brand-600 rounded flex items-center justify-center text-xs font-bold">
                    2
                  </span>
                  Context Delta
                  {proposal.context_delta.risk_label && (
                    <span className="ml-auto text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full">
                      {proposal.context_delta.risk_label}
                    </span>
                  )}
                </h3>

                {/* Conflicts — shown first */}
                {proposal.context_delta.conflicts &&
                  proposal.context_delta.conflicts.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                        ⚠ Conflicts Detected
                      </p>
                      <div className="space-y-2">
                        {proposal.context_delta.conflicts.map((c, i) => (
                          <div
                            key={i}
                            className="bg-red-50 border border-red-200 rounded-lg p-3"
                          >
                            <p className="text-xs font-semibold text-red-700 mb-1">
                              § {c.heading}
                            </p>
                            <p className="text-sm text-red-800">{c.conflict}</p>
                            <span
                              className={`text-xs font-medium mt-1 inline-block px-1.5 py-0.5 rounded ${
                                c.severity === "high"
                                  ? "bg-red-100 text-red-600"
                                  : c.severity === "medium"
                                  ? "bg-amber-100 text-amber-600"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {c.severity} severity
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Learned facts */}
                {proposal.context_delta.learned_facts &&
                  proposal.context_delta.learned_facts.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        ✓ Learned Facts
                      </p>
                      <ul className="space-y-1.5">
                        {proposal.context_delta.learned_facts.map((f, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-slate-700 bg-green-50 px-3 py-1.5 rounded-lg"
                          >
                            <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* Missing info */}
                {proposal.context_delta.missing_info &&
                  proposal.context_delta.missing_info.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        ? Missing Information
                      </p>
                      <ul className="space-y-1.5">
                        {proposal.context_delta.missing_info.map((m, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-slate-500 bg-amber-50 px-3 py-1.5 rounded-lg"
                          >
                            <span className="text-amber-400 mt-0.5 flex-shrink-0">?</span>
                            {m}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* Suggested context update */}
                {proposal.context_delta.suggested_context_update && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Suggested Context Update
                    </p>
                    <div className="bg-slate-950 rounded-lg p-4">
                      <pre className="text-xs text-green-400 whitespace-pre-wrap font-mono leading-relaxed">
                        {proposal.context_delta.suggested_context_update}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Citations */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                  <span className="w-5 h-5 bg-brand-100 text-brand-600 rounded flex items-center justify-center text-xs font-bold">
                    3
                  </span>
                  Citations ({proposal.citations?.length ?? 0})
                </h3>

                {/* Context version used */}
                {usedContextVersion && (
                  <p className="text-xs text-slate-400 mb-3 ml-7">
                    Based on context{" "}
                    <Link
                      href={`/properties/${ticket.property_id}/context?version=${usedContextVersion.version}`}
                      className="font-semibold text-brand-600 hover:underline"
                    >
                      v{usedContextVersion.version}
                    </Link>{" "}
                    (by {usedContextVersion.created_by})
                  </p>
                )}

                <div className="space-y-3">
                  {(proposal.citations ?? []).map((c, i) => {
                    // Build section anchor from heading text (matches MarkdownRenderer anchor logic)
                    const anchor = c.heading
                      .toLowerCase()
                      .replace(/\s+/g, "-")
                      .replace(/[^a-z0-9-]/g, "");
                    const contextHref = ticket.property_id && usedContextVersion
                      ? `/properties/${ticket.property_id}/context?version=${usedContextVersion.version}#${anchor}`
                      : null;

                    return (
                      <div
                        key={i}
                        className="border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold text-brand-700">
                            § {c.heading}
                          </p>
                          {contextHref && (
                            <Link
                              href={contextHref}
                              className="text-xs text-slate-400 hover:text-brand-600 transition-colors font-medium flex-shrink-0 ml-2"
                              title="View this section in context"
                            >
                              View ↗
                            </Link>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 italic mb-2">
                          &ldquo;{c.excerpt}&rdquo;
                        </p>
                        <p className="text-xs text-slate-400">{c.relevance}</p>
                      </div>
                    );
                  })}
                  {(!proposal.citations || proposal.citations.length === 0) && (
                    <p className="text-sm text-slate-400 text-center py-3">
                      No citations available.
                    </p>
                  )}
                </div>
              </div>

              {/* 4. Policy Evaluation */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <span className="w-5 h-5 bg-brand-100 text-brand-600 rounded flex items-center justify-center text-xs font-bold">
                    4
                  </span>
                  Policy Evaluation
                </h3>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-slate-700">
                    {proposal.policy_evaluation.summary}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-slate-500">Recommendation:</span>
                    <span className="text-xs font-semibold text-slate-700">
                      {proposal.policy_evaluation.recommendation}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {(proposal.policy_evaluation.matched_policies ?? []).map(
                    (p, i) => (
                      <div
                        key={i}
                        className={`border rounded-lg p-3 ${
                          p.violated
                            ? "border-red-200 bg-red-50"
                            : "border-slate-100 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                            {p.kind}
                          </span>
                          <EffectBadge effect={p.effect} />
                          {p.violated && (
                            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">
                              VIOLATED
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-700">{p.description}</p>
                      </div>
                    )
                  )}
                  {(!proposal.policy_evaluation.matched_policies ||
                    proposal.policy_evaluation.matched_policies.length === 0) && (
                    <p className="text-sm text-slate-400 text-center py-3">
                      No policies matched.
                    </p>
                  )}
                </div>
              </div>

              {/* 5. Human Review (action buttons) */}
              <ProposalReview
                proposalId={proposal.id}
                actionStatus={proposal.action_status}
                memoryStatus={proposal.memory_status}
                suggestedUpdate={proposal.context_delta.suggested_context_update}
                proposedAction={
                  proposal.proposed_external_action as Record<string, unknown>
                }
                propertyId={ticket.property_id}
                currentContextVersion={usedContextVersion?.version ?? null}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
