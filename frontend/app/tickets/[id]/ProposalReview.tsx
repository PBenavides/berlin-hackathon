"use client";

import { useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ProposalReviewProps {
  proposalId: string;
  actionStatus: string;
  memoryStatus: string;
  suggestedUpdate: string | null;
}

export function ProposalReview({
  proposalId,
  actionStatus,
  memoryStatus,
  suggestedUpdate,
}: ProposalReviewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [actionDone, setActionDone] = useState(actionStatus !== "pending");
  const [memoryDone, setMemoryDone] = useState(memoryStatus !== "pending");
  const [rejectionReason, setRejectionReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decideAction(decision: "approve" | "reject") {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/proposals/${proposalId}/action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            reviewed_by: "operator",
            rejection_reason: decision === "reject" ? rejectionReason : undefined,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Request failed");
      }
      setActionDone(true);
      setFeedback(
        decision === "approve"
          ? "✓ External action approved"
          : "✗ External action rejected"
      );
      setTimeout(() => window.location.reload(), 1200);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  async function decideMemory(decision: "approve" | "reject") {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/proposals/${proposalId}/memory`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            reviewed_by: "operator",
            rejection_reason: decision === "reject" ? rejectionReason : undefined,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Request failed");
      }
      setMemoryDone(true);
      setFeedback(
        decision === "approve"
          ? "✓ Context updated — property memory improved!"
          : "✗ Context update rejected"
      );
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  if (actionDone && memoryDone) {
    return (
      <div className="card p-5 bg-green-50 border-green-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-green-800">Review Complete</p>
            <p className="text-sm text-green-600">
              Both action and memory decisions have been recorded.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <span className="w-5 h-5 bg-brand-100 text-brand-600 rounded flex items-center justify-center text-xs font-bold">
          5
        </span>
        Human Review
      </h3>

      {feedback && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm font-medium text-green-700">
          {feedback}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Error: {error}
        </div>
      )}

      <div className="space-y-5">
        {/* Action decision */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">
            External Action Decision
          </p>
          {actionDone ? (
            <p className="text-sm text-green-600 font-medium">
              ✓ Decision recorded ({actionStatus})
            </p>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => decideAction("approve")}
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isLoading ? "..." : "✓ Approve Action"}
              </button>
              <button
                onClick={() => decideAction("reject")}
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                ✗ Reject Action
              </button>
            </div>
          )}
        </div>

        {/* Memory decision */}
        {suggestedUpdate && (
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">
              Context Memory Update
            </p>
            {memoryDone ? (
              <p className="text-sm text-green-600 font-medium">
                ✓ Memory decision recorded ({memoryStatus})
              </p>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => decideMemory("approve")}
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoading ? "..." : "✓ Apply to Context"}
                </button>
                <button
                  onClick={() => decideMemory("reject")}
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  Skip Update
                </button>
              </div>
            )}
          </div>
        )}

        {/* Rejection reason */}
        {!actionDone && (
          <div>
            <label className="text-xs text-slate-500 block mb-1">
              Rejection reason (optional)
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-2 h-16 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Explain why this is being rejected..."
            />
          </div>
        )}
      </div>
    </div>
  );
}
