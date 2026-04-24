"use client";

import { useState } from "react";

const DEMO_STEPS = [
  {
    step: 1,
    emoji: "🎯",
    title: "Simulate a Ticket",
    description: 'Click the "Recurring Bathroom Leak" template above to create a realistic maintenance ticket.',
    hint: "The DEMO badge marks the recommended template",
  },
  {
    step: 2,
    emoji: "🤖",
    title: "View the AI Proposal",
    description: "The ticket appears instantly with an AI-generated proposal — including context conflicts, citations, and a risk assessment.",
    hint: "Look for the ⚠ Conflicts Detected section — it shows the recurring issue pattern",
  },
  {
    step: 3,
    emoji: "✓",
    title: "Approve the External Action",
    description: 'In the Human Review section, click "Approve" on the External Action panel to authorize the contractor dispatch.',
    hint: "Or click Edit & Approve to modify the draft message first",
  },
  {
    step: 4,
    emoji: "🧠",
    title: "Apply the Memory Update",
    description: 'Click "Apply to Context" in the Memory Update panel to persist the new facts to the property\'s context document.',
    hint: "You'll see the context version number increment (e.g., v1 → v2)",
  },
  {
    step: 5,
    emoji: "📄",
    title: "View the Context Diff",
    description: 'Click "View diff →" to see exactly what changed in the property memory after your decision.',
    hint: "The diff highlights added/removed lines in the context document",
  },
  {
    step: 6,
    emoji: "📋",
    title: "Check the Audit Trail",
    description: 'Click "View audit trail" or navigate to Audit Log to see the complete chain of events.',
    hint: "Every action is logged: ticket.create → proposal.create → context.write",
  },
];

export function DemoGuide() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
      >
        <span className="w-5 h-5 bg-brand-100 rounded-full flex items-center justify-center text-xs font-bold text-brand-600">
          ?
        </span>
        5-minute demo guide
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="mt-3 card p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">End-to-End Demo Scenario</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Follow these steps to demonstrate the full Buena ContextOps value proposition
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 transition-colors ml-3 flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DEMO_STEPS.map((s) => (
              <div
                key={s.step}
                className="flex gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
              >
                <div className="flex-shrink-0">
                  <div className="w-7 h-7 bg-brand-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-brand-700">{s.step}</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-base">{s.emoji}</span>
                    <p className="text-xs font-semibold text-slate-800">{s.title}</p>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed mb-1.5">
                    {s.description}
                  </p>
                  <p className="text-xs text-slate-400 italic">
                    💡 {s.hint}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 flex items-center gap-2">
            <span className="text-xs text-slate-500">⏱</span>
            <p className="text-xs text-slate-500">
              Total time: ~5 minutes · No account needed · All data resets with the ↺ reset db button
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
