"use client";

import { useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ProposalReviewProps {
  proposalId: string;
  actionStatus: string;
  memoryStatus: string;
  suggestedUpdate: string | null;
  proposedAction?: Record<string, unknown> | null;
}

type ActionMode = "idle" | "editing";
type MemoryMode = "idle" | "editing";

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    approved: "✓ Approved",
    edited: "✎ Approved (edited)",
    rejected: "✗ Rejected",
    pending: "Pending",
  };
  return map[status] ?? status;
}

function isDecisionFinal(status: string): boolean {
  return ["approved", "edited", "rejected"].includes(status);
}

export function ProposalReview({
  proposalId,
  actionStatus,
  memoryStatus,
  suggestedUpdate,
  proposedAction,
}: ProposalReviewProps) {
  // Shared
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Action state
  const [actionDone, setActionDone] = useState(isDecisionFinal(actionStatus));
  const [currentActionStatus, setCurrentActionStatus] = useState(actionStatus);
  const [actionMode, setActionMode] = useState<ActionMode>("idle");
  const [editedActionJson, setEditedActionJson] = useState(
    proposedAction ? JSON.stringify(proposedAction, null, 2) : "{}"
  );
  const [actionJsonError, setActionJsonError] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Memory state
  const [memoryDone, setMemoryDone] = useState(isDecisionFinal(memoryStatus));
  const [currentMemoryStatus, setCurrentMemoryStatus] = useState(memoryStatus);
  const [memoryMode, setMemoryMode] = useState<MemoryMode>("idle");
  const [editedMemoryMd, setEditedMemoryMd] = useState(suggestedUpdate ?? "");

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async function post(url: string, body: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = data?.detail ?? `HTTP ${res.status}`;
      const err = new Error(msg) as Error & { status: number };
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  // ---------------------------------------------------------------------------
  // Action decision handlers
  // ---------------------------------------------------------------------------

  async function handleApproveAction() {
    setIsLoading(true);
    setError(null);
    try {
      await post(`/api/v1/proposals/${proposalId}/action/approve`, {
        reviewed_by: "operator",
      });
      setActionDone(true);
      setCurrentActionStatus("approved");
      setFeedback("✓ External action approved");
      setTimeout(() => window.location.reload(), 1200);
    } catch (e: unknown) {
      const err = e as Error & { status?: number };
      if (err.status === 409) {
        setError("⚠ This action was already rejected and cannot be approved.");
      } else {
        setError(err.message ?? "Unknown error");
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleEditAction() {
    setActionJsonError(null);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(editedActionJson);
    } catch {
      setActionJsonError("Invalid JSON — please fix before submitting.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await post(`/api/v1/proposals/${proposalId}/action/edit`, {
        reviewed_by: "operator",
        edited_action: parsed,
      });
      setActionDone(true);
      setCurrentActionStatus("edited");
      setFeedback("✎ External action saved with edits");
      setTimeout(() => window.location.reload(), 1200);
    } catch (e: unknown) {
      const err = e as Error & { status?: number };
      if (err.status === 409) {
        setError("⚠ This action was already rejected and cannot be edited.");
      } else {
        setError(err.message ?? "Unknown error");
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRejectAction() {
    setIsLoading(true);
    setError(null);
    try {
      await post(`/api/v1/proposals/${proposalId}/action/reject`, {
        reviewed_by: "operator",
        rejection_reason: rejectionReason || undefined,
      });
      setActionDone(true);
      setCurrentActionStatus("rejected");
      setFeedback("✗ External action rejected");
      setTimeout(() => window.location.reload(), 1200);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Memory decision handlers
  // ---------------------------------------------------------------------------

  async function handleApproveMemory() {
    setIsLoading(true);
    setError(null);
    try {
      await post(`/api/v1/proposals/${proposalId}/memory/approve`, {
        reviewed_by: "operator",
      });
      setMemoryDone(true);
      setCurrentMemoryStatus("approved");
      setFeedback("✓ Context updated — property memory improved!");
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleEditMemory() {
    if (!editedMemoryMd.trim()) {
      setError("Edited context cannot be empty.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await post(`/api/v1/proposals/${proposalId}/memory/edit`, {
        reviewed_by: "operator",
        edited_context_md: editedMemoryMd,
      });
      setMemoryDone(true);
      setCurrentMemoryStatus("edited");
      setFeedback("✎ Context updated with your edits");
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRejectMemory() {
    setIsLoading(true);
    setError(null);
    try {
      await post(`/api/v1/proposals/${proposalId}/memory/reject`, {
        reviewed_by: "operator",
      });
      setMemoryDone(true);
      setCurrentMemoryStatus("rejected");
      setFeedback("✗ Context update skipped");
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render: all done
  // ---------------------------------------------------------------------------

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
              Action: {statusLabel(currentActionStatus)} · Memory: {statusLabel(currentMemoryStatus)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: review panel
  // ---------------------------------------------------------------------------

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <span className="w-5 h-5 bg-brand-100 text-brand-600 rounded flex items-center justify-center text-xs font-bold">
          5
        </span>
        Human Review
      </h3>

      {/* Feedback / Error banners */}
      {feedback && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm font-medium text-green-700">
          {feedback}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* ---------------------------------------------------------------- */}
        {/* External Action Decision                                          */}
        {/* ---------------------------------------------------------------- */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">
            External Action Decision
          </p>

          {actionDone ? (
            <p className="text-sm text-green-600 font-medium">
              {statusLabel(currentActionStatus)}
            </p>
          ) : actionMode === "editing" ? (
            <div className="space-y-3">
              <label className="text-xs text-slate-500 block mb-1">
                Edit proposed action (JSON)
              </label>
              <textarea
                value={editedActionJson}
                onChange={(e) => {
                  setEditedActionJson(e.target.value);
                  setActionJsonError(null);
                }}
                className="w-full text-xs font-mono border border-slate-300 rounded-lg p-3 h-40 resize-y focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {actionJsonError && (
                <p className="text-xs text-red-600">{actionJsonError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleEditAction}
                  disabled={isLoading}
                  className="flex-1 py-2 px-4 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoading ? "Saving…" : "✎ Save Edits"}
                </button>
                <button
                  onClick={() => setActionMode("idle")}
                  disabled={isLoading}
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={handleApproveAction}
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoading ? "…" : "✓ Approve"}
                </button>
                <button
                  onClick={() => setActionMode("editing")}
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-4 bg-brand-100 hover:bg-brand-200 text-brand-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  ✎ Edit & Approve
                </button>
                <button
                  onClick={handleRejectAction}
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-4 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  ✗ Reject
                </button>
              </div>

              {/* Rejection reason */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Rejection reason (optional)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 h-16 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Explain why this action is being rejected…"
                />
              </div>
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Memory (Context) Decision                                         */}
        {/* ---------------------------------------------------------------- */}
        {suggestedUpdate && (
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">
              Context Memory Update
            </p>

            {memoryDone ? (
              <p className="text-sm text-green-600 font-medium">
                {statusLabel(currentMemoryStatus)}
              </p>
            ) : memoryMode === "editing" ? (
              <div className="space-y-3">
                <label className="text-xs text-slate-500 block mb-1">
                  Edit context update (Markdown)
                </label>
                <textarea
                  value={editedMemoryMd}
                  onChange={(e) => setEditedMemoryMd(e.target.value)}
                  className="w-full text-sm font-mono border border-slate-300 rounded-lg p-3 h-48 resize-y focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleEditMemory}
                    disabled={isLoading}
                    className="flex-1 py-2 px-4 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isLoading ? "Saving…" : "✎ Apply Edits"}
                  </button>
                  <button
                    onClick={() => setMemoryMode("idle")}
                    disabled={isLoading}
                    className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleApproveMemory}
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoading ? "…" : "✓ Apply to Context"}
                </button>
                <button
                  onClick={() => setMemoryMode("editing")}
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  ✎ Edit First
                </button>
                <button
                  onClick={handleRejectMemory}
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-500 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  Skip Update
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
