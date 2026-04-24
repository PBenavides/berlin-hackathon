"use client";

import { useState } from "react";
import Link from "next/link";

interface DemoFlowHintProps {
  actionStatus: string;
  memoryStatus: string;
  propertyId: string | null;
}

const steps = [
  { id: "view", label: "View AI Proposal", emoji: "🤖" },
  { id: "action", label: "Approve External Action", emoji: "✓" },
  { id: "memory", label: "Apply Memory Update", emoji: "🧠" },
  { id: "diff", label: "View Context Diff", emoji: "📄" },
  { id: "audit", label: "Check Audit Trail", emoji: "📋" },
];

export function DemoFlowHint({ actionStatus, memoryStatus, propertyId }: DemoFlowHintProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const actionDone = ["approved", "edited", "rejected"].includes(actionStatus);
  const memoryDone = ["approved", "edited", "rejected"].includes(memoryStatus);
  const bothDone = actionDone && memoryDone;

  // Compute current step index
  let currentStepIdx = 0;
  if (bothDone) currentStepIdx = 3; // next is diff
  else if (actionDone) currentStepIdx = 2; // next is memory
  else currentStepIdx = 1; // next is action

  const stepCompletedMap: Record<string, boolean> = {
    view: true, // always true once on this page
    action: actionDone,
    memory: memoryDone,
    diff: false,
    audit: false,
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">🎯 Demo Progress</span>
          <span className="text-xs text-slate-400">— 5-minute walkthrough</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-300 hover:text-slate-500 transition-colors"
          title="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {steps.map((step, idx) => {
          const done = stepCompletedMap[step.id];
          const isCurrent = idx === currentStepIdx && !done;

          return (
            <div key={step.id} className="flex items-center gap-1 flex-shrink-0">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  done
                    ? "bg-green-100 text-green-700 border border-green-200"
                    : isCurrent
                    ? "bg-brand-100 text-brand-700 border border-brand-200 ring-1 ring-brand-300"
                    : "bg-slate-100 text-slate-400 border border-slate-200"
                }`}
              >
                {done ? (
                  <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-sm leading-none">{step.emoji}</span>
                )}
                <span className="whitespace-nowrap">{step.label}</span>
                {isCurrent && (
                  <span className="text-[10px] bg-brand-200 text-brand-800 px-1 py-0.5 rounded font-bold uppercase leading-none">
                    Next
                  </span>
                )}
              </div>
              {idx < steps.length - 1 && (
                <span className="text-slate-300 text-xs">›</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Contextual guidance */}
      {bothDone && propertyId && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-3">
          <p className="text-xs text-slate-500 w-full">
            🎉 Both decisions recorded! Complete the demo by viewing the context diff and audit trail:
          </p>
          <Link
            href={`/properties/${propertyId}/context?showDiff=1`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
          >
            📄 View Context Diff
          </Link>
          <Link
            href={`/audit?property_id=${propertyId}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            📋 View Audit Trail
          </Link>
        </div>
      )}
    </div>
  );
}
