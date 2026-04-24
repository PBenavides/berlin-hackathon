import { notFound } from "next/navigation";
import { ProposalReview } from "./ProposalReview";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-semibold border ${
        styles[risk] ?? "bg-slate-100 text-slate-700 border-slate-200"
      }`}
    >
      {risk === "critical" ? "🚨" : risk === "high" ? "⚠️" : risk === "medium" ? "⚡" : "✓"}
      {risk.toUpperCase()} RISK
    </span>
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
  const createdAt = new Date(ticket.created_at).toLocaleString("en-DE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <a href="/tickets" className="hover:text-slate-900 transition-colors">
          Tickets
        </a>
        <span>/</span>
        <span className="text-slate-900 font-medium truncate">{ticket.subject}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Ticket info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <StatusBadge status={ticket.status} />
              <span className="text-xs text-slate-400">{createdAt}</span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 mb-2">
              {ticket.subject}
            </h1>
            <div className="text-sm text-slate-500 space-y-1 mb-4">
              <p>
                <span className="font-medium">From:</span> {ticket.raised_by}
              </p>
              <p>
                <span className="font-medium">Source:</span> {ticket.source}
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
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                Proposal Status
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Action</span>
                  <StatusBadge status={proposal.action_status} />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Memory</span>
                  <StatusBadge status={proposal.memory_status} />
                </div>
                {proposal.confidence !== null && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Confidence</span>
                    <span className="font-medium text-slate-900">
                      {Math.round((proposal.confidence as number) * 100)}%
                    </span>
                  </div>
                )}
                {proposal.reviewed_by && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Reviewed by</span>
                    <span className="font-medium text-slate-900">
                      {proposal.reviewed_by}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Proposal detail */}
        <div className="lg:col-span-2 space-y-4">
          {!proposal ? (
            <div className="card p-8 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-slate-600 font-medium">Proposal generation pending</p>
              <p className="text-sm text-slate-400 mt-1">
                The AI is generating a proposal for this ticket.
              </p>
            </div>
          ) : (
            <>
              {/* Risk header */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-slate-900">
                    AI Proposal
                  </h2>
                  <RiskBadge risk={proposal.risk_level} />
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {proposal.reasoning}
                </p>
              </div>

              {/* External action */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 bg-brand-100 text-brand-600 rounded flex items-center justify-center text-xs font-bold">1</span>
                  Proposed External Action
                </h3>
                <p className="text-sm text-slate-800 leading-relaxed mb-4">
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
                              className="flex items-start gap-2 text-sm text-slate-700"
                            >
                              <span className="flex-shrink-0 w-5 h-5 bg-slate-100 rounded text-xs font-medium flex items-center justify-center mt-0.5">
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

              {/* Context delta */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 bg-brand-100 text-brand-600 rounded flex items-center justify-center text-xs font-bold">2</span>
                  Context Delta
                </h3>

                {/* Conflicts — shown first, most important */}
                {proposal.context_delta.conflicts &&
                  proposal.context_delta.conflicts.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-red-500 uppercase tracking-wide mb-2">
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
                            <span className={`text-xs font-medium mt-1 inline-block ${
                              c.severity === "high"
                                ? "text-red-600"
                                : c.severity === "medium"
                                ? "text-amber-600"
                                : "text-slate-500"
                            }`}>
                              Severity: {c.severity}
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
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                        Learned Facts
                      </p>
                      <ul className="space-y-1">
                        {proposal.context_delta.learned_facts.map((f, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-slate-700"
                          >
                            <span className="text-green-500 mt-0.5">✓</span>
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
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                        Missing Information
                      </p>
                      <ul className="space-y-1">
                        {proposal.context_delta.missing_info.map((m, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-slate-500"
                          >
                            <span className="text-amber-400 mt-0.5">?</span>
                            {m}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* Suggested context update */}
                {proposal.context_delta.suggested_context_update && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                      Suggested Context Update
                    </p>
                    <div className="bg-slate-900 rounded-lg p-4">
                      <pre className="text-xs text-green-400 whitespace-pre-wrap font-mono leading-relaxed">
                        {proposal.context_delta.suggested_context_update}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              {/* Citations */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 bg-brand-100 text-brand-600 rounded flex items-center justify-center text-xs font-bold">3</span>
                  Citations ({proposal.citations?.length ?? 0})
                </h3>
                <div className="space-y-3">
                  {(proposal.citations ?? []).map((c, i) => (
                    <div
                      key={i}
                      className="border border-slate-200 rounded-lg p-3"
                    >
                      <p className="text-xs font-semibold text-brand-700 mb-1">
                        § {c.heading}
                      </p>
                      <p className="text-sm text-slate-600 italic mb-2">
                        "{c.excerpt}"
                      </p>
                      <p className="text-xs text-slate-400">{c.relevance}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Policy evaluation */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 bg-brand-100 text-brand-600 rounded flex items-center justify-center text-xs font-bold">4</span>
                  Policy Evaluation
                </h3>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3">
                  <p className="text-sm text-slate-700">
                    {proposal.policy_evaluation.summary}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Recommendation:{" "}
                    <span className="font-medium text-slate-700">
                      {proposal.policy_evaluation.recommendation}
                    </span>
                  </p>
                </div>
                <div className="space-y-2">
                  {(proposal.policy_evaluation.matched_policies ?? []).map(
                    (p, i) => (
                      <div
                        key={i}
                        className={`border rounded-lg p-3 ${
                          p.violated
                            ? "border-red-200 bg-red-50"
                            : "border-slate-100"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {p.kind}
                          </span>
                          {p.violated && (
                            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                              VIOLATED
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-700 mb-1">
                          {p.description}
                        </p>
                        <p className="text-xs text-slate-500">{p.effect}</p>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Action buttons — client component for interactivity */}
              <ProposalReview
                proposalId={proposal.id}
                actionStatus={proposal.action_status}
                memoryStatus={proposal.memory_status}
                suggestedUpdate={proposal.context_delta.suggested_context_update}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
