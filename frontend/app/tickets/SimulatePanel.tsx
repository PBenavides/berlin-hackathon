"use client";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TEMPLATES = [
  { id: "tpl-leak-3b", label: "🚿 Leak 3B", color: "text-red-400" },
  { id: "tpl-heating", label: "🔥 Heating", color: "text-orange-400" },
  { id: "tpl-noise", label: "🔊 Noise", color: "text-yellow-400" },
  { id: "tpl-lease", label: "📜 Lease", color: "text-blue-400" },
  { id: "tpl-payment", label: "💰 Payment", color: "text-green-400" },
];

export function SimulatePanel() {
  async function simulate(templateId: string) {
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
    } catch (e) {
      alert("Network error — is the backend running?");
    }
  }

  return (
    <div className="mb-6 p-4 bg-slate-900 rounded-xl">
      <p className="text-xs text-slate-400 font-mono mb-3">
        ↓ Simulate a ticket (picks from seeded templates):
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => simulate(t.id)}
            className="px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition-colors text-center"
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
