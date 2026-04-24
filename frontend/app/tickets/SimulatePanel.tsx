"use client";

import { useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TEMPLATES = [
  { id: "tpl-leak-3b", label: "🚿 Leak 3B", color: "text-red-400" },
  { id: "tpl-heating", label: "🔥 Heating", color: "text-orange-400" },
  { id: "tpl-noise", label: "🔊 Noise", color: "text-yellow-400" },
  { id: "tpl-lease", label: "📜 Lease", color: "text-blue-400" },
  { id: "tpl-payment", label: "💰 Payment", color: "text-green-400" },
];

interface SimulatePanelProps {
  /** When set, show a note that tickets land on this property */
  propertyName?: string;
}

export function SimulatePanel({ propertyName }: SimulatePanelProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  async function simulate(templateId: string) {
    setLoading(templateId);
    try {
      const res = await fetch(`${API_BASE}/api/v1/dev/simulate-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: templateId }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const err = await res.json();
        alert(`Error: ${err.detail || "Unknown error"}`);
      }
    } catch {
      alert("Network error — is the backend running?");
    } finally {
      setLoading(null);
    }
  }

  async function resetDb() {
    if (!confirm("⚠ This will delete ALL data and re-seed. Continue?")) return;
    setResetting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/dev/reset`, {
        method: "POST",
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const err = await res.json();
        alert(`Reset error: ${err.detail || "Unknown error"}`);
      }
    } catch {
      alert("Network error — is the backend running?");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="mb-6 p-4 bg-slate-900 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-400 font-mono">
          ↓ Simulate a ticket (picks from seeded templates)
          {propertyName && (
            <span className="ml-1 text-slate-500">
              — routed by template to its property
            </span>
          )}
        </p>
        <button
          onClick={resetDb}
          disabled={resetting}
          title="Reset & re-seed the database"
          className="text-xs text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50 font-mono"
        >
          {resetting ? "resetting…" : "↺ reset db"}
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => simulate(t.id)}
            disabled={loading !== null}
            className="px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition-colors text-center disabled:opacity-60"
          >
            {loading === t.id ? (
              <span className="animate-pulse">⏳ …</span>
            ) : (
              t.label
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
