"use client";

/**
 * activity-feed.tsx
 *
 * Collapsible panel showing a live stream of everything the auto-solve agent
 * is doing across all tickets.  Connects to the SSE feed on mount and keeps
 * the 50 most-recent entries in memory.
 *
 * Designed to sit at the bottom of the page as a persistent overlay that the
 * demo presenter can leave visible while navigating between pages.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Mail,
  MessageCircle,
  FileText,
  ShieldAlert,
  TicketCheck,
  Loader2,
  Zap,
  BarChart3,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAutoSolve } from "@/lib/auto-solve-context";
import type { AgentActivityEntry, ActivityEventType } from "@/lib/types";

const MAX_ENTRIES = 50;

// ---------------------------------------------------------------------------
// Severity → visual config
// ---------------------------------------------------------------------------

const SEVERITY_CONFIG = {
  info:    { icon: Info,         cls: "text-blue-500",    bg: "bg-blue-500/10" },
  success: { icon: CheckCircle2, cls: "text-emerald-500", bg: "bg-emerald-500/10" },
  warning: { icon: AlertTriangle, cls: "text-amber-500",  bg: "bg-amber-500/10" },
  error:   { icon: XCircle,      cls: "text-red-500",     bg: "bg-red-500/10" },
} as const;

// ---------------------------------------------------------------------------
// Action type → icon
// ---------------------------------------------------------------------------

function ActionIcon({ actionType, eventType }: { actionType: string | null; eventType: ActivityEventType }) {
  if (eventType === "action_escalated") return <ShieldAlert className="h-3 w-3 text-amber-500" />;
  if (eventType === "action_confirmed" || eventType === "ticket_completed") return <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
  if (eventType === "queue_started" || eventType === "queue_stopped") return <Zap className="h-3 w-3 text-blue-500" />;
  if (eventType === "ticket_error") return <XCircle className="h-3 w-3 text-red-500" />;
  switch (actionType) {
    case "send_vendor_email":  return <Mail className="h-3 w-3 text-muted-foreground" />;
    case "respond_to_tenant":  return <MessageCircle className="h-3 w-3 text-muted-foreground" />;
    case "send_owner_report":  return <FileText className="h-3 w-3 text-muted-foreground" />;
    case "escalate_to_human":  return <ShieldAlert className="h-3 w-3 text-amber-500" />;
    case "approve_ticket":     return <TicketCheck className="h-3 w-3 text-emerald-500" />;
    default:                   return <Activity className="h-3 w-3 text-muted-foreground" />;
  }
}

// ---------------------------------------------------------------------------
// Single feed entry row
// ---------------------------------------------------------------------------

function FeedEntry({ entry }: { entry: AgentActivityEntry }) {
  const sev = SEVERITY_CONFIG[entry.severity] ?? SEVERITY_CONFIG.info;
  const SevIcon = sev.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md px-3 py-2 text-xs transition-colors",
        entry.severity === "warning" && "bg-amber-500/5 border border-amber-500/20",
        entry.severity === "error" && "bg-red-500/5 border border-red-500/20",
      )}
    >
      {/* Severity icon */}
      <SevIcon className={cn("mt-0.5 h-3 w-3 shrink-0", sev.cls)} />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <ActionIcon actionType={entry.actionType} eventType={entry.eventType} />
          {entry.ticketNum && (
            <Link
              href={`/ticket/${entry.ticketId}`}
              className="font-mono text-[10px] font-medium text-foreground/80 hover:text-foreground hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {entry.ticketNum}
            </Link>
          )}
          <span className="truncate text-muted-foreground">{entry.description.replace(/^\[.*?\]\s*/, "")}</span>
        </div>
      </div>

      {/* Timestamp */}
      <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/60">
        {entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ActivityFeed() {
  const [collapsed, setCollapsed] = useState(true);
  const [entries, setEntries] = useState<AgentActivityEntry[]>([]);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { autoSolve, queueStatus, summary, openSummary } = useAutoSolve();

  // Load initial recent entries
  useEffect(() => {
    api.agentQueue.recentFeed(50).then((data) => {
      // API returns newest-first; reverse for chronological display
      setEntries([...data].reverse());
    }).catch(() => {});
  }, []);

  // Connect to SSE feed for live updates
  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();

    const connect = async () => {
      try {
        await api.agentQueue.streamFeed({
          signal: ctrl.signal,
          onActivity: (entry) => {
            if (cancelled) return;
            // Skip pure queue_status events (they have no display-worthy content)
            if (entry.eventType === "queue_status") return;
            setEntries((prev) => {
              const next = [...prev, entry].slice(-MAX_ENTRIES);
              return next;
            });
            if (collapsed) {
              setUnread((n) => n + 1);
            }
          },
        });
      } catch {
        if (!cancelled) setTimeout(connect, 3000);
      }
    };
    connect();
    return () => { cancelled = true; ctrl.abort(); };
  }, [collapsed]);

  // Auto-scroll to bottom when new entries arrive and feed is open
  useEffect(() => {
    if (!collapsed && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, collapsed]);

  // Reset unread count when opened
  const handleToggle = useCallback(() => {
    setCollapsed((v) => {
      if (v) setUnread(0);
      return !v;
    });
  }, []);

  return (
    <div
      className={cn(
        "fixed bottom-0 right-4 z-40 flex w-96 flex-col rounded-t-xl border bg-background shadow-2xl transition-all duration-200",
        collapsed ? "h-10" : "h-80"
      )}
    >
      {/* Header bar */}
      <button
        onClick={handleToggle}
        className="flex h-10 shrink-0 items-center justify-between gap-2 rounded-t-xl px-4 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">Agent Activity</span>
          {autoSolve && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          )}
          {queueStatus.currentTicketNum && (
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-mono text-blue-600 dark:text-blue-400">
              {queueStatus.currentTicketNum}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Summary re-open button (s4-f1) */}
          {summary && collapsed && (
            <button
              onClick={(e) => { e.stopPropagation(); openSummary(); }}
              title="View session summary"
              className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-600 hover:bg-emerald-500/30 transition-colors dark:text-emerald-400"
            >
              <BarChart3 className="h-2.5 w-2.5" />
              Summary
            </button>
          )}
          {unread > 0 && collapsed && (
            <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
          {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>

      {/* Feed content */}
      {!collapsed && (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-2 space-y-0.5"
        >
          {entries.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              {autoSolve ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Agent is starting…
                </span>
              ) : (
                "No activity yet — activate Auto-Solve to see the agent work"
              )}
            </div>
          ) : (
            entries.map((e, i) => (
              <div key={e.id ?? `e-${i}`} className="feed-entry-appear" style={{ animationDelay: `${Math.min(i * 20, 200)}ms` }}>
                <FeedEntry entry={e} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
