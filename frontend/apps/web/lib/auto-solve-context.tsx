"use client";

/**
 * auto-solve-context.tsx
 *
 * Provides the auto-solve toggle state across the entire app without a
 * full Zustand dependency.  State is stored in sessionStorage so it
 * persists across in-session navigations but resets on tab close.
 *
 * Also maintains the live queue status by connecting to the SSE feed.
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
import type { QueueStatus } from "./types";

const DEFAULT_STATUS: QueueStatus = {
  isRunning: false,
  currentTicketId: null,
  currentTicketNum: null,
  remainingCount: 0,
  processedCount: 0,
  failedCount: 0,
};

interface AutoSolveCtx {
  autoSolve: boolean;
  queueStatus: QueueStatus;
  isToggling: boolean;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

const Ctx = createContext<AutoSolveCtx>({
  autoSolve: false,
  queueStatus: DEFAULT_STATUS,
  isToggling: false,
  enable: async () => {},
  disable: async () => {},
});

const SESSION_KEY = "buena:autoSolve";

export function AutoSolveProvider({ children }: { children: React.ReactNode }) {
  const [autoSolve, setAutoSolve] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(SESSION_KEY) === "true";
  });
  const [queueStatus, setQueueStatus] = useState<QueueStatus>(DEFAULT_STATUS);
  const [isToggling, setIsToggling] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Keep sessionStorage in sync
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SESSION_KEY, String(autoSolve));
    }
  }, [autoSolve]);

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
      }
    }).catch(() => {});

    return () => {
      cancelled = true;
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enable = useCallback(async () => {
    setIsToggling(true);
    try {
      const result = await api.agentQueue.start();
      setQueueStatus(result);
      setAutoSolve(true);
    } finally {
      setIsToggling(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setIsToggling(true);
    try {
      const result = await api.agentQueue.stop();
      setQueueStatus(result);
      setAutoSolve(false);
    } finally {
      setIsToggling(false);
    }
  }, []);

  return (
    <Ctx.Provider value={{ autoSolve, queueStatus, isToggling, enable, disable }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAutoSolve() {
  return useContext(Ctx);
}
