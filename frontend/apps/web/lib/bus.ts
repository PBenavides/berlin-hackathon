"use client";

export type BusEvent =
  | { kind: "ticket-changed";  ticketId?: string; propertyId?: string }
  | { kind: "context-bumped";  propertyId: string; version: number }
  | { kind: "auto-solve-changed"; isRunning: boolean }
  | { kind: "queue-tick" };

const EVENT_NAME = "buena:bus";

export function emit(event: BusEvent): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: event }));
}

export function subscribe(listener: (event: BusEvent) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const ce = e as CustomEvent<BusEvent>;
    if (ce.detail) listener(ce.detail);
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
