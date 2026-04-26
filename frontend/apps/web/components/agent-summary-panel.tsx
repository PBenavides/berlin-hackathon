"use client";

/**
 * agent-summary-panel.tsx  (Sprint 4, s4-f1)
 *
 * Modal summary panel that appears automatically when the agent finishes
 * processing all tickets (queue_exhausted event).
 *
 * Shows:
 *  - Total tickets processed
 *  - Per-action-type counts (vendor emails, tenant responses, owner reports)
 *  - Escalated tickets (called out separately with reasons)
 *  - Total processing time and tickets-per-minute
 *
 * Dismissible via the X button or Escape key.
 * Can be re-opened from the Demo Control Bar.
 */

import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";
import {
  X,
  Mail,
  MessageCircle,
  FileText,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Zap,
  TrendingUp,
  TicketCheck,
} from "lucide-react";
import { useAutoSolve } from "@/lib/auto-solve-context";

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  accent?: "emerald" | "blue" | "amber" | "red" | "purple";
}) {
  const accentMap = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    blue:    "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    red:     "bg-red-500/10 text-red-600 dark:text-red-400",
    purple:  "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  };

  return (
    <div className={cn(
      "flex items-center gap-3 rounded-xl border p-4",
      accent && "border-transparent",
      accent ? accentMap[accent] : "border-border"
    )}>
      <div className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
        accent ? `bg-current/10` : "bg-muted"
      )}>
        <Icon className={cn("h-4 w-4", !accent && "text-muted-foreground")} />
      </div>
      <div>
        <div className="text-2xl font-bold tabular-nums leading-none">{value}</div>
        <div className={cn("text-xs mt-0.5", accent ? "opacity-80" : "text-muted-foreground")}>{label}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AgentSummaryPanel() {
  const { summary, showSummary, dismissSummary } = useAutoSolve();

  if (!showSummary || !summary) return null;

  const minutes = Math.floor(summary.processingTimeSeconds / 60);
  const seconds = Math.round(summary.processingTimeSeconds % 60);
  const timeLabel = minutes > 0
    ? `${minutes}m ${seconds}s`
    : `${seconds}s`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="summary-panel-title"
      onClick={dismissSummary}
      onKeyDown={(e) => { if (e.key === "Escape") dismissSummary(); }}
      tabIndex={-1}
    >
      <div
        className="relative mx-4 w-full max-w-lg rounded-2xl border bg-background p-6 shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={dismissSummary}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="Close summary"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h2 id="summary-panel-title" className="text-lg font-semibold">
              Agent Session Complete
            </h2>
            <p className="text-sm text-muted-foreground">
              Hermes finished processing all available tickets
            </p>
          </div>
        </div>

        {/* Main stats grid */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <StatCard
            icon={TicketCheck}
            label="Tickets processed"
            value={summary.ticketsProcessed}
            accent="emerald"
          />
          <StatCard
            icon={CheckCircle2}
            label="Actions confirmed"
            value={summary.totalConfirmed}
            accent="blue"
          />
          <StatCard
            icon={Mail}
            label="Vendor emails sent"
            value={summary.vendorEmails}
            accent="purple"
          />
          <StatCard
            icon={MessageCircle}
            label="Tenant responses"
            value={summary.tenantResponses}
            accent="blue"
          />
          <StatCard
            icon={FileText}
            label="Owner reports"
            value={summary.ownerReports}
            accent="amber"
          />
          <StatCard
            icon={ShieldAlert}
            label="Escalated to human"
            value={summary.escalations}
            accent={summary.escalations > 0 ? "red" : "emerald"}
          />
        </div>

        {/* Timing row */}
        <div className="mb-4 flex items-center gap-4 rounded-xl bg-muted/50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Processing time:</span>
            <span className="font-mono font-semibold">{timeLabel}</span>
          </div>
          {summary.ticketsPerMinute > 0 && (
            <>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Rate:</span>
                <span className="font-mono font-semibold">
                  {summary.ticketsPerMinute} tickets/min
                </span>
              </div>
            </>
          )}
        </div>

        {/* Escalated tickets detail */}
        {summary.escalatedTickets && summary.escalatedTickets.length > 0 && (
          <div className="mb-4">
            <div className="mb-2 flex items-center gap-2">
              <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
              <span className="text-xs font-semibold uppercase tracking-wider text-destructive/80">
                Requires human review ({summary.escalatedTickets.length})
              </span>
            </div>
            <div className="space-y-2">
              {summary.escalatedTickets.map((t) => (
                <Link
                  key={t.ticketId}
                  href={`/ticket/${t.ticketId}`}
                  onClick={dismissSummary}
                  className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 hover:border-destructive/40 transition-colors"
                >
                  <span className="mt-0.5 font-mono text-xs font-medium text-destructive/80 shrink-0">
                    {t.ticketNum}
                  </span>
                  <span className="text-xs text-muted-foreground line-clamp-2 flex-1">
                    {t.reason}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Results are preserved until you reset the demo.
          </p>
          <div className="flex items-center gap-2">
            <Link
              href="/escalations"
              onClick={dismissSummary}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
            >
              <ShieldAlert className="h-3 w-3" />
              View Escalations
            </Link>
            <button
              onClick={dismissSummary}
              className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:bg-foreground/90 transition-colors"
            >
              <Zap className="h-3 w-3" />
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
