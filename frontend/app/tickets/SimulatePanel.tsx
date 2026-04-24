"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Template {
  id: string;
  icon: string;
  label: string;
  description: string;
  from: string;
  risk: "high" | "medium" | "low";
  recommended?: boolean;
}

const TEMPLATES: Template[] = [
  {
    id: "tpl-leak-3b",
    icon: "🚿",
    label: "Recurring Bathroom Leak",
    description: "Third leak report in 6 months from Apt 3B — triggers context conflict detection and contractor dispatch proposal.",
    from: "tenant_anna@maple.com",
    risk: "high",
    recommended: true,
  },
  {
    id: "tpl-heating",
    icon: "🔥",
    label: "Heating Outage",
    description: "Tenant reports no heat in winter. Urgent safety concern requiring immediate HVAC contractor dispatch.",
    from: "tenant_bob@maple.com",
    risk: "medium",
  },
  {
    id: "tpl-noise",
    icon: "🔊",
    label: "Noise Complaint",
    description: "Noise disturbance from neighboring unit during late hours. Requires owner escalation.",
    from: "tenant_carol@riverside.com",
    risk: "low",
  },
  {
    id: "tpl-lease",
    icon: "📜",
    label: "Rent Increase Question",
    description: "Tenant challenges legality of upcoming rent increase. Triggers legal escalation policy.",
    from: "tenant_dan@riverside.com",
    risk: "medium",
  },
  {
    id: "tpl-payment",
    icon: "💰",
    label: "Overdue Payment",
    description: "Tenant reports payment was sent but not credited. Formal payment reminder process initiated.",
    from: "tenant_eve@maple.com",
    risk: "low",
  },
];

const RISK_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-green-100 text-green-700 border-green-200",
};

interface SimulatePanelProps {
  propertyName?: string;
}

export function SimulatePanel({ propertyName }: SimulatePanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function simulate(templateId: string) {
    setLoading(templateId);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/dev/simulate-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: templateId }),
      });
      if (res.ok) {
        const ticket = await res.json();
        // Navigate to the newly created ticket
        if (ticket?.id) {
          router.push(`/tickets/${ticket.id}`);
        } else {
          router.refresh();
        }
      } else {
        const err = await res.json();
        setError(`Error: ${err.detail || "Unknown error"}`);
      }
    } catch {
      setError("Network error — is the backend running?");
    } finally {
      setLoading(null);
    }
  }

  async function resetDb() {
    if (!confirm("⚠ This will delete ALL data and re-seed. Continue?")) return;
    setResetting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/dev/reset`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      } else {
        const err = await res.json();
        setError(`Reset error: ${err.detail || "Unknown error"}`);
      }
    } catch {
      setError("Network error — is the backend running?");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="mb-6 rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-slate-300 text-sm font-semibold">🎯 Demo Simulator</span>
          {propertyName && (
            <span className="text-xs text-slate-500">— routed by template to its property</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={resetDb}
            disabled={resetting}
            title="Reset & re-seed the database"
            className="text-xs text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50 font-mono"
          >
            {resetting ? (
              <span className="animate-pulse">resetting…</span>
            ) : (
              "↺ reset db"
            )}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors font-medium"
          >
            {expanded ? "▲ collapse" : "▼ show templates"}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-3 p-2.5 bg-red-900/50 border border-red-700 rounded-lg text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Quick buttons (always visible) */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => simulate(t.id)}
              disabled={loading !== null}
              title={t.description}
              className={`px-3 py-2.5 text-xs font-medium rounded-lg transition-all text-center disabled:opacity-60 relative ${
                t.recommended
                  ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-600/50 ring-1 ring-amber-500/30"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              }`}
            >
              {t.recommended && (
                <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-slate-900 text-[9px] font-bold px-1 py-0.5 rounded-full leading-none">
                  DEMO
                </span>
              )}
              {loading === t.id ? (
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating…
                </span>
              ) : (
                <>
                  <span className="block text-base leading-none mb-1">{t.icon}</span>
                  <span className="block text-[10px] leading-tight">{t.label.split(" ").slice(0, 2).join(" ")}</span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Expanded template cards */}
      {expanded && (
        <div className="border-t border-slate-700 p-4 space-y-2">
          <p className="text-xs text-slate-500 mb-3 font-medium uppercase tracking-wider">
            All ticket templates
          </p>
          {TEMPLATES.map((t) => (
            <div
              key={t.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                t.recommended
                  ? "border-amber-600/40 bg-amber-500/10 hover:bg-amber-500/20"
                  : "border-slate-700 bg-slate-800/50 hover:bg-slate-800"
              } ${loading === t.id ? "opacity-60 pointer-events-none" : ""}`}
              onClick={() => loading === null && simulate(t.id)}
            >
              <span className="text-2xl flex-shrink-0 mt-0.5">{t.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-semibold text-slate-200">{t.label}</span>
                  {t.recommended && (
                    <span className="text-[10px] font-bold bg-amber-500 text-slate-900 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                      Recommended Demo
                    </span>
                  )}
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border uppercase tracking-wide ${RISK_STYLES[t.risk]}`}>
                    {t.risk} risk
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{t.description}</p>
                <p className="text-xs text-slate-600 mt-1">From: {t.from}</p>
              </div>
              <div className="flex-shrink-0">
                {loading === t.id ? (
                  <svg className="animate-spin w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <span className="text-slate-600 text-lg">→</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
