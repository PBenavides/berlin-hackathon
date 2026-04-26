"use client";

/**
 * demo-control-bar.tsx  (Sprint 4, s4-f3 + s4-f5)
 *
 * Unified demo control surface — a compact floating pill fixed at the
 * bottom-center of the viewport (between the sidebar and the activity feed).
 *
 * Contains:
 *  1. Demo Mode badge
 *  2. Agent toggle (ON/OFF) with animated state indicator
 *  3. Live agent status (idle / processing GAR-XXX / finished)
 *  4. Progress indicator (X/Y tickets processed)
 *  5. Speed selector (Slow / Normal / Fast)  — s4-f5
 *  6. Reset button
 *  7. Summary re-open button (when summary data is available)
 *
 * Collapses to a minimal pill when not in active demo mode.
 * Fixed at z-50 so it floats above content but below modals (z-50+).
 */

import { useState, useCallback } from "react";
import { cn } from "@repo/ui/lib/utils";
import {
  Zap,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Loader2,
  Gauge,
  BarChart3,
  Turtle,
  Rabbit,
  Play,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAutoSolve } from "@/lib/auto-solve-context";
import { useToastSafe } from "@/components/toaster";
import type { DemoSpeed } from "@/lib/types";
import { DEMO_SPEED_CONFIGS } from "@/lib/demo-constants";

// ---------------------------------------------------------------------------
// Speed selector button
// ---------------------------------------------------------------------------

const SPEED_ICONS: Record<DemoSpeed, React.ComponentType<{ className?: string }>> = {
  slow:   Turtle,
  normal: Gauge,
  fast:   Rabbit,
};

function SpeedButton({
  value,
  current,
  onChange,
  disabled,
}: {
  value: DemoSpeed;
  current: DemoSpeed;
  onChange: (s: DemoSpeed) => void;
  disabled?: boolean;
}) {
  const config = DEMO_SPEED_CONFIGS[value];
  const Icon = SPEED_ICONS[value];
  const active = value === current;

  return (
    <button
      onClick={() => onChange(value)}
      disabled={disabled}
      title={`${config.label}: ${config.description}`}
      className={cn(
        "flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-all duration-150",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DemoControlBar() {
  const {
    autoSolve,
    queueStatus,
    isToggling,
    speed,
    setSpeed,
    summary,
    openSummary,
    enable,
    disable,
  } = useAutoSolve();

  const [expanded, setExpanded] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showAutoSolveConfirm, setShowAutoSolveConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const toast = useToastSafe();

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  const handleToggle = useCallback(() => {
    if (autoSolve) {
      disable().then(() => {
        toast.push({
          title: "Auto-Solve stopped",
          description: "Agent will finish the current ticket then stop.",
          variant: "default",
        });
      }).catch((err: unknown) => {
        toast.push({
          title: "Failed to stop",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      });
    } else {
      setShowAutoSolveConfirm(true);
    }
  }, [autoSolve, disable, toast]);

  const handleAutoSolveConfirm = useCallback(async () => {
    setShowAutoSolveConfirm(false);
    try {
      await enable();
      toast.push({
        title: "Auto-Solve activated",
        description: `Hermes is processing tickets at ${DEMO_SPEED_CONFIGS[speed].label.toLowerCase()} speed.`,
        variant: "success",
      });
    } catch (err: unknown) {
      toast.push({
        title: "Failed to start",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }, [enable, speed, toast]);

  const handleReset = useCallback(async () => {
    setShowResetConfirm(false);
    setResetting(true);
    // Stop agent first if running (s4-f4 hardening)
    if (autoSolve) {
      try { await disable(); } catch { /* ignore */ }
    }
    try {
      await api.dev.reset();
      toast.push({
        title: "Demo zurückgesetzt",
        description: "Alle Tickets und Daten wurden auf den Demo-Ausgangszustand zurückgesetzt.",
        variant: "success",
      });
      // Reset speed to Normal so the next demo session starts at the default pace (s4-f5)
      setSpeed("normal");
      window.location.href = "/overview";
    } catch (err: unknown) {
      toast.push({
        title: "Reset fehlgeschlagen",
        description: err instanceof Error ? err.message : "Unbekannter Fehler beim Zurücksetzen.",
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  }, [autoSolve, disable, setSpeed, toast]);

  // ------------------------------------------------------------------
  // Derived display values
  // ------------------------------------------------------------------

  const processed = queueStatus.processedCount ?? 0;
  const total = processed + (queueStatus.remainingCount ?? 0);
  const progress = total > 0 ? Math.round((processed / total) * 100) : 0;
  const isFinished = !queueStatus.isRunning && processed > 0 && queueStatus.remainingCount === 0;

  function agentStatusLabel(): string {
    if (isToggling) return "Connecting…";
    if (autoSolve && queueStatus.currentTicketNum) {
      return `Processing ${queueStatus.currentTicketNum}`;
    }
    if (autoSolve) return "Starting…";
    if (isFinished) return "All done ✓";
    return "Idle";
  }

  // ------------------------------------------------------------------
  // Collapsed pill (when not actively used)
  // ------------------------------------------------------------------

  if (!expanded) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
        <button
          onClick={() => setExpanded(true)}
          className={cn(
            "flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium shadow-lg backdrop-blur-sm transition-all duration-200",
            autoSolve
              ? "border-emerald-500/50 bg-emerald-950/90 text-emerald-400"
              : "border-border bg-background/90 text-muted-foreground hover:text-foreground"
          )}
        >
          <span className={cn(
            "h-1.5 w-1.5 rounded-full",
            autoSolve ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
          )} />
          Demo Mode
          {autoSolve && queueStatus.currentTicketNum && (
            <span className="font-mono">{queueStatus.currentTicketNum}</span>
          )}
          <ChevronUp className="h-3 w-3" />
        </button>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Expanded control bar
  // ------------------------------------------------------------------

  return (
    <>
      {/* Main bar */}
      <div
        className={cn(
          "fixed bottom-4 left-1/2 -translate-x-1/2 z-40",
          "flex items-center gap-3 rounded-2xl border px-4 py-2.5 shadow-2xl backdrop-blur-sm",
          "transition-all duration-300 ease-out animate-slide-up",
          autoSolve
            ? "border-emerald-500/30 bg-emerald-950/95 dark:bg-emerald-950/95"
            : "border-border bg-background/95"
        )}
        style={{ maxWidth: "calc(100vw - 280px - 6rem)" }}
      >
        {/* Demo Mode badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0",
            autoSolve ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
          )} />
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-wider shrink-0",
            autoSolve ? "text-emerald-400" : "text-amber-600 dark:text-amber-400"
          )}>
            Demo
          </span>
        </div>

        <div className="h-4 w-px bg-border shrink-0" />

        {/* Agent toggle */}
        <button
          onClick={handleToggle}
          disabled={isToggling || resetting}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all duration-200",
            autoSolve
              ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/30 shadow-md"
              : "bg-foreground text-background hover:bg-foreground/90",
            (isToggling || resetting) && "opacity-60 cursor-not-allowed"
          )}
          title={autoSolve ? "Stop Auto-Solve" : "Start Auto-Solve"}
        >
          {isToggling ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : autoSolve ? (
            <Zap className="h-3 w-3 animate-pulse" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          {autoSolve ? "ON" : "OFF"}
        </button>

        {/* Agent status label */}
        <div className="flex min-w-0 flex-col shrink-0">
          <span className={cn(
            "text-[11px] font-medium transition-colors",
            autoSolve ? "text-emerald-300" : isFinished ? "text-emerald-400" : "text-muted-foreground"
          )}>
            {agentStatusLabel()}
          </span>
          {total > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {processed}/{total} tickets
            </span>
          )}
        </div>

        {/* Progress bar (only when active or recently finished) */}
        {total > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-border">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500 ease-out",
                  isFinished ? "bg-emerald-500" : "bg-emerald-400"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums w-7">
              {progress}%
            </span>
          </div>
        )}

        <div className="h-4 w-px bg-border shrink-0" />

        {/* Speed selector (s4-f5) — locked while running; backend speed is set at start */}
        <div
          className="flex items-center gap-1 shrink-0"
          title={autoSolve ? "Speed is locked while the agent is running" : undefined}
        >
          {(["slow", "normal", "fast"] as DemoSpeed[]).map((s) => (
            <SpeedButton
              key={s}
              value={s}
              current={speed}
              onChange={setSpeed}
              disabled={autoSolve}
            />
          ))}
        </div>

        <div className="h-4 w-px bg-border shrink-0" />

        {/* Summary re-open (s4-f1) */}
        {summary && (
          <button
            onClick={openSummary}
            title="View session summary"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors shrink-0"
          >
            <BarChart3 className="h-3 w-3" />
            Summary
          </button>
        )}

        {/* Reset button */}
        <button
          onClick={() => setShowResetConfirm(true)}
          disabled={resetting}
          title="Reset Demo"
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors shrink-0",
            "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
            resetting && "opacity-60 cursor-not-allowed"
          )}
        >
          {resetting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RotateCcw className="h-3 w-3" />
          )}
          {resetting ? "…" : "Reset"}
        </button>

        {/* Collapse */}
        <button
          onClick={() => setExpanded(false)}
          title="Collapse control bar"
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Auto-Solve Confirmation Dialog */}
      {showAutoSolveConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowAutoSolveConfirm(false)}
          onKeyDown={(e) => { if (e.key === "Escape") setShowAutoSolveConfirm(false); }}
          tabIndex={-1}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-xl border bg-background p-6 shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center gap-2">
              <Zap className="h-5 w-5 text-emerald-500" />
              <h2 className="text-base font-semibold">Activate Agent Auto-Solve?</h2>
            </div>
            <p className="mb-2 text-sm text-muted-foreground">
              Hermes will autonomously process <strong>all open tickets</strong> one by one, in priority order.
            </p>
            <div className="mb-4 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
              <span className="text-xs text-muted-foreground">Speed:</span>
              <div className="flex gap-1">
                {(["slow", "normal", "fast"] as DemoSpeed[]).map((s) => (
                  <SpeedButton key={s} value={s} current={speed} onChange={setSpeed} />
                ))}
              </div>
            </div>
            <ul className="mb-5 space-y-1 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                Write actions (emails, responses, reports) auto-confirm after a brief delay
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                Human escalations are <strong>not</strong> auto-confirmed — they stay pending
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                You can stop the agent at any time — the current ticket will finish
              </li>
            </ul>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAutoSolveConfirm(false)}
                className="rounded-md px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleAutoSolveConfirm}
                className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
              >
                <Zap className="h-3.5 w-3.5" />
                Activate Auto-Solve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowResetConfirm(false)}
          onKeyDown={(e) => { if (e.key === "Escape") setShowResetConfirm(false); }}
          tabIndex={-1}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-xl border bg-background p-6 shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-destructive" />
              <h2 className="text-base font-semibold">Demo zurücksetzen?</h2>
            </div>
            <p className="mb-5 text-sm text-muted-foreground">
              Alle Tickets, Vorschläge, Kontextänderungen und Protokolle werden gelöscht und
              durch den Demo-Ausgangszustand ersetzt.{" "}
              <strong>Diese Aktion kann nicht rückgängig gemacht werden.</strong>
            </p>
            {autoSolve && (
              <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                ⚠ Der Agent wird vor dem Zurücksetzen gestoppt.
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="rounded-md px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Abbrechen
              </button>
              <button
                onClick={handleReset}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Ja, zurücksetzen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
