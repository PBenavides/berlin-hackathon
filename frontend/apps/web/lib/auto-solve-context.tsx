"use client";

/**
 * auto-solve-context.tsx
 *
 * Provides the auto-solve toggle state across the entire app without a
 * full Zustand dependency.  State is stored in sessionStorage so it
 * persists across in-session navigations but resets on tab close.
 *
 * Also maintains the live queue status by connecting to the SSE feed.
 *
 * Sprint 4 additions:
 *  - speed: DemoSpeed — controls how fast the agent processes tickets (s4-f5)
 *  - summary: QueueSummary | null — populated when queue exhausts (s4-f1)
 *  - showSummary: boolean — whether the summary panel is visible
 *  - escalatedTickets: Array — accumulated from action_escalated SSE events
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { api } from "./api";
import type { DemoSpeed, QueueStatus, QueueSummary } from "./types";

const DEFAULT_STATUS: QueueStatus = {
  isRunning: false,
  currentTicketId: null,
  currentTicketNum: null,
  remainingCount: 0,
  processedCount: 0,
  failedCount: 0,
  speed: "normal",
};

interface EscalatedTicketRef {
  ticketNum: string;
  ticketId: string;
  reason: string;
}

interface AutoSolveCtx {
  autoSolve: boolean;
  queueStatus: QueueStatus;
  isToggling: boolean;
  // Speed controls (s4-f5)
  speed: DemoSpeed;
  setSpeed: (s: DemoSpeed) => void;
  // Summary panel (s4-f1)
  summary: QueueSummary | null;
  showSummary: boolean;
  openSummary: () => void;
  dismissSummary: () => void;
  // Escalated tickets (accumulated from SSE)
  escalatedTickets: EscalatedTicketRef[];
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

const Ctx = createContext<AutoSolveCtx>({
  autoSolve: false,
  queueStatus: DEFAULT_STATUS,
  isToggling: false,
  speed: "normal",
  setSpeed: () => {},
  summary: null,
  showSummary: false,
  openSummary: () => {},
  dismissSummary: () => {},
  escalatedTickets: [],
  enable: async () => {},
  disable: async () => {},
});

const SESSION_KEY = "buena:autoSolve";
const SPEED_KEY = "buena:demoSpeed";

export function AutoSolveProvider({ children }: { children: React.ReactNode }) {
  const [autoSolve, setAutoSolve] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(SESSION_KEY) === "true";
  });
  const [queueStatus, setQueueStatus] = useState<QueueStatus>(DEFAULT_STATUS);
  const [isToggling, setIsToggling] = useState(false);
  // Speed control (s4-f5)
  const [speed, setSpeedState] = useState<DemoSpeed>(() => {
    if (typeof window === "undefined") return "normal";
    return (sessionStorage.getItem(SPEED_KEY) as DemoSpeed) || "normal";
  });
  // Summary state (s4-f1)
  const [summary, setSummary] = useState<QueueSummary | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [escalatedTickets, setEscalatedTickets] = useState<EscalatedTicketRef[]>([]);
  // Mirror escalated tickets in a ref so onQueueExhausted can read the current
  // list synchronously without being nested inside a state updater (self-fix: avoid
  // calling setSummary/setShowSummary as side-effects of setEscalatedTickets updater).
  const escalatedTicketsRef = useRef<EscalatedTicketRef[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  // Debounce ref for rapid toggle protection (s4-f4)
  const lastToggleRef = useRef<number>(0);

  // Keep sessionStorage in sync
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SESSION_KEY, String(autoSolve));
    }
  }, [autoSolve]);

  const setSpeed = useCallback((s: DemoSpeed) => {
    setSpeedState(s);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SPEED_KEY, s);
    }
  }, []);

  // Connect to the SSE feed to receive live status updates
  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const connect = async () => {
      try {
        await api.agentQueue.streamFeed({
          signal: ctrl.signal,
          onQueueStatus: (s) => {
            if (!cancelled) {
              setQueueStatus(s);
              if (!s.isRunning && autoSolve) {
                // Queue stopped (e.g. queue exhausted)
                setAutoSolve(false);
              }
            }
          },
          onQueueStopped: () => {
            if (!cancelled) setAutoSolve(false);
          },
          onQueueExhausted: (incomingSummary) => {
            if (!cancelled) {
              // Use ref to read current escalated tickets synchronously — avoids
              // calling setSummary/setShowSummary as side-effects inside a state
              // updater (self-fix: React concurrent-mode safe pattern).
              const merged: QueueSummary = {
                ...incomingSummary,
                escalatedTickets: escalatedTicketsRef.current,
              };
              setSummary(merged);
              setShowSummary(true);
              setAutoSolve(false);
            }
          },
          onActivity: (entry) => {
            if (!cancelled && entry.eventType === "action_escalated") {
              // Accumulate escalated ticket refs for the summary panel
              const ticketNum = entry.ticketNum ?? "?";
              const ticketId = entry.ticketId ?? "";
              // Extract reason from description: "[GAR-001] Escalated to human: <reason>"
              const reasonMatch = entry.description.match(/Escalated to human:\s*(.+)/i);
              const reason = reasonMatch ? reasonMatch[1].trim() : entry.description;
              setEscalatedTickets((prev) => {
                // Dedup by ticketId
                if (prev.some((e) => e.ticketId === ticketId)) return prev;
                const next = [...prev, { ticketNum, ticketId, reason }];
                // Keep ref in sync so onQueueExhausted can read it synchronously
                escalatedTicketsRef.current = next;
                return next;
              });
            }
          },
        });
      } catch {
        // Reconnect after 3s if not cancelled
        if (!cancelled) {
          setTimeout(() => {
            if (!cancelled) connect();
          }, 3000);
        }
      }
    };

    connect();

    // Also poll status on mount in case SSE is slow to connect
    api.agentQueue.status().then((s) => {
      if (!cancelled) {
        setQueueStatus(s);
        setAutoSolve(s.isRunning);
        sessionStorage.setItem(SESSION_KEY, String(s.isRunning));
        // Sync speed from backend if available
        if (s.speed) setSpeedState(s.speed);
      }
    }).catch(() => {});

    return () => {
      cancelled = true;
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enable = useCallback(async () => {
    // Debounce rapid toggle (s4-f4): ignore if toggled within last 500ms
    const now = Date.now();
    if (now - lastToggleRef.current < 500) return;
    lastToggleRef.current = now;

    setIsToggling(true);
    try {
      // Reset escalated tickets for this new run (state + ref)
      setEscalatedTickets([]);
      escalatedTicketsRef.current = [];
      setSummary(null);
      const result = await api.agentQueue.start(speed);
      setQueueStatus(result);
      setAutoSolve(true);
    } finally {
      setIsToggling(false);
    }
  }, [speed]);

  const disable = useCallback(async () => {
    // Debounce rapid toggle (s4-f4)
    const now = Date.now();
    if (now - lastToggleRef.current < 500) return;
    lastToggleRef.current = now;

    setIsToggling(true);
    try {
      const result = await api.agentQueue.stop();
      setQueueStatus(result);
      setAutoSolve(false);
    } finally {
      setIsToggling(false);
    }
  }, []);

  const openSummary = useCallback(() => setShowSummary(true), []);
  const dismissSummary = useCallback(() => setShowSummary(false), []);

  return (
    <Ctx.Provider value={{
      autoSolve, queueStatus, isToggling,
      speed, setSpeed,
      summary, showSummary, openSummary, dismissSummary,
      escalatedTickets,
      enable, disable,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAutoSolve() {
  return useContext(Ctx);
}
