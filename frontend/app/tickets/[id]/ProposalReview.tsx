"use client";

import { useState } from "react";
import Link from "next/link";
import { DemoFlowHint } from "./DemoFlowHint";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ProposalReviewProps {
  proposalId: string;
  actionStatus: string;
  memoryStatus: string;
  suggestedUpdate: string | null;
  proposedAction?: Record<string, unknown> | null;
  propertyId?: string | null;
  currentContextVersion?: number | null;
}

type ActionMode = "idle" | "editing" | "rejecting";
type MemoryMode = "idle" | "editing" | "rejecting";

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    approved: "✓ Approved",
    edited: "✎ Approved (edited)",
    rejected: "✗ Rejected",
    pending: "Pending review",
  };
  return map[status] ?? status;
}

function isDecisionFinal(status: string): boolean {
  return ["approved", "edited", "rejected"].includes(status);
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved: "bg-green-100 text-green-700 border-green-200",
    edited: "bg-purple-100 text-purple-700 border-purple-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
    pending: "bg-amber-100 text-amber-700 border-amber-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        styles[status] ?? "bg-slate-100 text-slate-600 border-slate-200"
      }`}
    >
      {statusLabel(status)}
    </span>
  );
}

function LoadingSpinner({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={`animate-spin ${small ? "w-4 h-4" : "w-5 h-5"} text-white`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// -------------------------------------------------------------------------
// Panel: External Action Decision
// -------------------------------------------------------------------------
function ActionDecisionPanel({
  proposalId,
  actionStatus,
  proposedAction,
  onDone,
}: {
  proposalId: string;
  actionStatus: string;
  proposedAction?: Record<string, unknown> | null;
  onDone: (status: string) => void;
}) {
  const [mode, setMode] = useState<ActionMode>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedActionJson, setEditedActionJson] = useState(
    proposedAction ? JSON.stringify(proposedAction, null, 2) : "{}"
  );
  const [actionJsonError, setActionJsonError] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [currentStatus, setCurrentStatus] = useState(actionStatus);
  const isDone = isDecisionFinal(currentStatus);

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

  async function handleApprove() {
    setIsLoading(true);
    setError(null);
    try {
      await post(`/api/v1/proposals/${proposalId}/action/approve`, {
        reviewed_by: "operator",
      });
      setCurrentStatus("approved");
      onDone("approved");
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

  async function handleEditSubmit() {
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
      setCurrentStatus("edited");
      onDone("edited");
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

  async function handleReject() {
    setIsLoading(true);
    setError(null);
    try {
      await post(`/api/v1/proposals/${proposalId}/action/reject`, {
        reviewed_by: "operator",
        rejection_reason: rejectionReason || undefined,
      });
      setCurrentStatus("rejected");
      onDone("rejected");
    } catch (e: unknown) {
      setError((e as Error).message ?? "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Panel header */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">External Action Decision</p>
            <p className="text-xs text-slate-500">Approve, edit, or reject the proposed action</p>
          </div>
        </div>
        <StatusBadge status={currentStatus} />
      </div>

      <div className="p-4">
        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
            <span className="flex-shrink-0 mt-0.5">⚠</span>
            <span>{error}</span>
          </div>
        )}

        {isDone ? (
          <div className="flex items-center gap-3 py-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              currentStatus === "rejected" ? "bg-red-100" : "bg-green-100"
            }`}>
              {currentStatus === "rejected" ? (
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{statusLabel(currentStatus)}</p>
              <p className="text-xs text-slate-500">External action decision recorded</p>
            </div>
          </div>
        ) : mode === "editing" ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 font-medium">Edit proposed action (JSON):</p>
            <textarea
              value={editedActionJson}
              onChange={(e) => {
                setEditedActionJson(e.target.value);
                setActionJsonError(null);
              }}
              className="w-full text-xs font-mono border border-slate-300 rounded-lg p-3 h-40 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {actionJsonError && (
              <p className="text-xs text-red-600 bg-red-50 px-2 py-1.5 rounded border border-red-200">
                {actionJsonError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleEditSubmit}
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <LoadingSpinner small /> : "✎ Save Edits"}
              </button>
              <button
                onClick={() => setMode("idle")}
                disabled={isLoading}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : mode === "rejecting" ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 font-medium">Rejection reason (optional):</p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg p-3 h-20 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
              placeholder="Explain why this action is being rejected…"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <LoadingSpinner small /> : "✗ Confirm Reject"}
              </button>
              <button
                onClick={() => setMode("idle")}
                disabled={isLoading}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleApprove}
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <LoadingSpinner small /> : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Approve
                </>
              )}
            </button>
            <button
              onClick={() => setMode("editing")}
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 border border-blue-200"
            >
              ✎ Edit & Approve
            </button>
            <button
              onClick={() => setMode("rejecting")}
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 border border-red-200"
            >
              ✗ Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Panel: Memory (Context) Decision
// -------------------------------------------------------------------------
function MemoryDecisionPanel({
  proposalId,
  memoryStatus,
  suggestedUpdate,
  propertyId,
  currentContextVersion,
  onDone,
}: {
  proposalId: string;
  memoryStatus: string;
  suggestedUpdate: string | null;
  propertyId?: string | null;
  currentContextVersion?: number | null;
  onDone: (status: string, newVersion?: number) => void;
}) {
  const [mode, setMode] = useState<MemoryMode>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedMemoryMd, setEditedMemoryMd] = useState(suggestedUpdate ?? "");
  const [rejectionReason, setRejectionReason] = useState("");
  const [currentStatus, setCurrentStatus] = useState(memoryStatus);
  const [newVersionNumber, setNewVersionNumber] = useState<number | null>(null);
  const isDone = isDecisionFinal(currentStatus);

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

  /** Fetch the latest context version number for a property after an approval. */
  async function fetchLatestContextVersion(pid: string): Promise<number | null> {
    try {
      const res = await fetch(`${API_BASE}/api/v1/properties/${pid}/context/versions`);
      if (!res.ok) return null;
      const versions: Array<{ version: number }> = await res.json();
      if (!versions || versions.length === 0) return null;
      return versions[0].version; // versions are sorted desc
    } catch {
      return null;
    }
  }

  async function handleApprove() {
    setIsLoading(true);
    setError(null);
    try {
      await post(`/api/v1/proposals/${proposalId}/memory/approve`, {
        reviewed_by: "operator",
      });
      // Fetch actual new version rather than guessing
      const actualVersion = propertyId
        ? await fetchLatestContextVersion(propertyId)
        : (currentContextVersion ? currentContextVersion + 1 : null);
      setNewVersionNumber(actualVersion);
      setCurrentStatus("approved");
      onDone("approved", actualVersion ?? undefined);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleEditSubmit() {
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
      // Fetch actual new version rather than guessing
      const actualVersion = propertyId
        ? await fetchLatestContextVersion(propertyId)
        : (currentContextVersion ? currentContextVersion + 1 : null);
      setNewVersionNumber(actualVersion);
      setCurrentStatus("edited");
      onDone("edited", actualVersion ?? undefined);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReject() {
    setIsLoading(true);
    setError(null);
    try {
      await post(`/api/v1/proposals/${proposalId}/memory/reject`, {
        reviewed_by: "operator",
        rejection_reason: rejectionReason || undefined,
      });
      setCurrentStatus("rejected");
      onDone("rejected");
    } catch (e: unknown) {
      setError((e as Error).message ?? "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  if (!suggestedUpdate) {
    return (
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Memory Update Decision</p>
              <p className="text-xs text-slate-500">No context update proposed for this ticket</p>
            </div>
          </div>
          <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">N/A</span>
        </div>
        <div className="p-4">
          <p className="text-sm text-slate-500 text-center py-2">
            The AI did not propose a context update for this ticket.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-purple-200 rounded-xl overflow-hidden">
      {/* Panel header */}
      <div className="bg-purple-50 border-b border-purple-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Memory Update Decision</p>
            <p className="text-xs text-slate-500">Apply this to the property context (creates new version)</p>
          </div>
        </div>
        <StatusBadge status={currentStatus} />
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
            <span className="flex-shrink-0 mt-0.5">⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* Success: new version created */}
        {isDone && (currentStatus === "approved" || currentStatus === "edited") && newVersionNumber && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-green-800">
                Context updated — new version created!
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-green-600">
                  Context version incremented:
                </span>
                <span className="text-xs font-bold bg-green-100 text-green-700 border border-green-300 px-2 py-0.5 rounded-full">
                  v{currentContextVersion} → v{newVersionNumber}
                </span>
                {propertyId && (
                  <Link
                    href={`/properties/${propertyId}/context?version=${newVersionNumber}&showDiff=1`}
                    className="text-xs text-green-700 underline hover:text-green-900 font-medium"
                  >
                    View diff →
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Rejected status */}
        {isDone && currentStatus === "rejected" && (
          <div className="flex items-center gap-3 py-2">
            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Context update skipped</p>
              <p className="text-xs text-slate-500">Property memory was not changed</p>
            </div>
          </div>
        )}

        {!isDone && (
          <>
            {/* Preview of suggested update */}
            <div>
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">
                Proposed Memory Addition
              </p>
              <div className="bg-slate-950 rounded-lg p-3 max-h-32 overflow-y-auto">
                <pre className="text-xs text-green-400 whitespace-pre-wrap font-mono leading-relaxed">
                  {suggestedUpdate}
                </pre>
              </div>
            </div>

            {mode === "editing" ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 font-medium">Edit context update (Markdown):</p>
                <textarea
                  value={editedMemoryMd}
                  onChange={(e) => setEditedMemoryMd(e.target.value)}
                  className="w-full text-sm font-mono border border-purple-300 rounded-lg p-3 h-48 resize-y focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleEditSubmit}
                    disabled={isLoading}
                    className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? <LoadingSpinner small /> : "✎ Apply Edits"}
                  </button>
                  <button
                    onClick={() => setMode("idle")}
                    disabled={isLoading}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : mode === "rejecting" ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 font-medium">Reason for skipping (optional):</p>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg p-3 h-20 resize-none focus:outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder="Explain why the context update is being skipped…"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleReject}
                    disabled={isLoading}
                    className="flex-1 py-2.5 px-4 bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? <LoadingSpinner small /> : "✗ Confirm Skip"}
                  </button>
                  <button
                    onClick={() => setMode("idle")}
                    disabled={isLoading}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleApprove}
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <LoadingSpinner small /> : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Apply to Context
                    </>
                  )}
                </button>
                <button
                  onClick={() => setMode("editing")}
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-4 bg-purple-50 hover:bg-purple-100 text-purple-700 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 border border-purple-200"
                >
                  ✎ Edit First
                </button>
                <button
                  onClick={() => setMode("rejecting")}
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-600 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 border border-slate-200"
                >
                  Skip Update
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Main export
// -------------------------------------------------------------------------
export function ProposalReview({
  proposalId,
  actionStatus,
  memoryStatus,
  suggestedUpdate,
  proposedAction,
  propertyId,
  currentContextVersion,
}: ProposalReviewProps) {
  const [currentActionStatus, setCurrentActionStatus] = useState(actionStatus);
  const [currentMemoryStatus, setCurrentMemoryStatus] = useState(memoryStatus);
  const [newContextVersion, setNewContextVersion] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const actionDone = isDecisionFinal(currentActionStatus);
  const memoryDone = isDecisionFinal(currentMemoryStatus);
  const bothDone = actionDone && memoryDone;

  function handleActionDone(status: string) {
    setCurrentActionStatus(status);
    setFeedback(
      status === "approved"
        ? "✓ External action approved"
        : status === "edited"
        ? "✎ External action saved with edits"
        : "✗ External action rejected"
    );
    setTimeout(() => setFeedback(null), 3000);
  }

  function handleMemoryDone(status: string, version?: number) {
    setCurrentMemoryStatus(status);
    if (version) setNewContextVersion(version);
    setFeedback(
      status === "approved" || status === "edited"
        ? `✓ Context updated — version ${version} created`
        : "Context update skipped"
    );
    setTimeout(() => setFeedback(null), 5000);
  }

  return (
    <div className="space-y-4">
      {/* Demo Flow Progress Indicator */}
      <DemoFlowHint
        actionStatus={currentActionStatus}
        memoryStatus={currentMemoryStatus}
        propertyId={propertyId ?? null}
      />

    <div className="card p-5">
      {/* Header */}
      <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <span className="w-5 h-5 bg-brand-100 text-brand-600 rounded flex items-center justify-center text-xs font-bold">
          5
        </span>
        Human Review
        {bothDone && (
          <span className="ml-auto text-xs font-medium bg-green-100 text-green-700 px-2.5 py-1 rounded-full border border-green-200">
            ✓ Review Complete
          </span>
        )}
      </h3>

      {/* Global feedback banner */}
      {feedback && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm font-medium text-green-700 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {feedback}
        </div>
      )}

      {/* All done banner */}
      {bothDone && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-emerald-800">Both decisions recorded</p>
            <p className="text-sm text-emerald-600">
              Action: {statusLabel(currentActionStatus)} · Memory: {statusLabel(currentMemoryStatus)}
              {newContextVersion && propertyId && (
                <>
                  {" "}·{" "}
                  <Link
                    href={`/properties/${propertyId}/context?version=${newContextVersion}&showDiff=1`}
                    className="underline hover:no-underline font-medium"
                  >
                    View context v{newContextVersion} diff
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Decision panels — side by side or stacked */}
      <div className="space-y-4">
        {/* Panel 1: External Action */}
        <ActionDecisionPanel
          proposalId={proposalId}
          actionStatus={currentActionStatus}
          proposedAction={proposedAction}
          onDone={handleActionDone}
        />

        {/* Panel 2: Memory / Context */}
        <MemoryDecisionPanel
          proposalId={proposalId}
          memoryStatus={currentMemoryStatus}
          suggestedUpdate={suggestedUpdate}
          propertyId={propertyId}
          currentContextVersion={currentContextVersion}
          onDone={handleMemoryDone}
        />
      </div>

      {/* Post-decision links */}
      {bothDone && propertyId && (
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-3">
          <Link
            href={`/properties/${propertyId}/context`}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            View context history
          </Link>
          <Link
            href={`/audit?property_id=${propertyId}`}
            className="text-sm text-slate-500 hover:text-slate-700 font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            View audit trail
          </Link>
        </div>
      )}
    </div>
    </div>
  );
}
