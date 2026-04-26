import type {
  Building, Layer, Owner, Property, PropertyContext, Ticket, Unit, Vendor,
} from "./types";

const BASE =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_BACKEND_URL) ||
  "http://localhost:8000";

export interface ApiErrorEnvelope {
  error: string;
  code: string;
  status: number;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly path: string;
  constructor(envelope: ApiErrorEnvelope, path: string) {
    super(envelope.error);
    this.name = "ApiError";
    this.code = envelope.code;
    this.status = envelope.status;
    this.path = path;
  }
}

export type ApiAction =
  | "approve" | "reject" | "saveMemory" | "skipMemory"
  | "extract" | "chat" | "load";

export function friendlyApiError(err: unknown, action?: ApiAction): { title: string; description?: string } {
  if (err instanceof ApiError) {
    if (err.code === "CONFLICT" && action === "saveMemory") {
      return {
        title: "Memory write blocked",
        description: "Vendor hasn't reported completion yet — we don't write memory until the job closes.",
      };
    }
    if (err.code === "CONFLICT") {
      return { title: "Action blocked", description: err.message };
    }
    if (err.code === "VALIDATION_ERROR") {
      return { title: "Invalid request", description: err.message };
    }
    if (err.code === "UNAUTHORIZED") {
      return { title: "Sign-in required", description: err.message };
    }
    if (err.code === "NOT_FOUND") {
      return { title: "Not found", description: err.message };
    }
    return { title: "Request failed", description: err.message };
  }
  if (err instanceof DOMException && err.name === "AbortError") {
    return { title: "Cancelled" };
  }
  return {
    title: "Unexpected error",
    description: err instanceof Error ? err.message : String(err),
  };
}

type FetchInit = Omit<RequestInit, "body"> & {
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
};

function buildUrl(path: string, query?: FetchInit["query"]): string {
  const url = new URL(path.startsWith("http") ? path : `${BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function request<T>(path: string, init: FetchInit = {}): Promise<T> {
  const { query, body, headers, ...rest } = init;
  const url = buildUrl(path, query);

  const res = await fetch(url, {
    ...rest,
    headers: {
      "Accept": "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    let envelope: ApiErrorEnvelope = {
      error: res.statusText || "Request failed",
      code: "HTTP_ERROR",
      status: res.status,
    };
    try {
      const parsed = await res.json();
      if (parsed && typeof parsed === "object" && "error" in parsed) {
        envelope = {
          error: String((parsed as ApiErrorEnvelope).error ?? envelope.error),
          code: String((parsed as ApiErrorEnvelope).code ?? envelope.code),
          status: Number((parsed as ApiErrorEnvelope).status ?? res.status),
        };
      }
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(envelope, path);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ---------- modules ----------

export const tickets = {
  list: (params?: { propertyId?: string; status?: string; risk?: string }) =>
    request<Ticket[]>("/api/tickets", { query: params }),
  get: (id: string) =>
    request<Ticket>(`/api/tickets/${encodeURIComponent(id)}`),
  approve: (id: string) =>
    request<{ status: string; vendorJob: Ticket["vendorJob"] }>(
      `/api/tickets/${encodeURIComponent(id)}/approve`,
      { method: "POST", body: {} }
    ),
  reject: (id: string, reason?: string) =>
    request<{ status: string }>(
      `/api/tickets/${encodeURIComponent(id)}/reject`,
      { method: "POST", body: { reason } }
    ),
  saveMemory: (id: string) =>
    request<{ status: "saved"; contextVersion: number }>(
      `/api/tickets/${encodeURIComponent(id)}/memory/save`,
      { method: "POST", body: {} }
    ),
  skipMemory: (id: string) =>
    request<{ status: "skipped" }>(
      `/api/tickets/${encodeURIComponent(id)}/memory/skip`,
      { method: "POST", body: {} }
    ),
};

export const properties = {
  list: () => request<Property[]>("/api/properties"),
  get: (id: string) => request<Property>(`/api/properties/${encodeURIComponent(id)}`),
  units: (id: string) =>
    request<Unit[]>(`/api/properties/${encodeURIComponent(id)}/units`),
};

export const context = {
  get: (propertyId: string) =>
    request<PropertyContext>(`/api/properties/${encodeURIComponent(propertyId)}/context`),
  versions: (propertyId: string) =>
    request<Array<{ version: number; createdAt: string; author: string; summary: string }>>(
      `/api/properties/${encodeURIComponent(propertyId)}/context/versions`
    ),
  version: (propertyId: string, version: number) =>
    request<PropertyContext>(
      `/api/properties/${encodeURIComponent(propertyId)}/context/versions/${version}`
    ),
};

export const owners = {
  list: () => request<Owner[]>("/api/owners"),
  get: (id: string) => request<Owner>(`/api/owners/${encodeURIComponent(id)}`),
};

export const buildings = {
  list: () => request<Building[]>("/api/buildings"),
  get: (id: string) => request<Building>(`/api/buildings/${encodeURIComponent(id)}`),
};

export const vendors = {
  list: (params?: { buildingId?: string }) =>
    request<Vendor[]>("/api/vendors", { query: params }),
  get: (id: string) =>
    request<Vendor & { cases: Array<{ id: string; propertyId: string; date: string; description: string; costEur: number; slaMet: boolean; rating: number }> }>(
      `/api/vendors/${encodeURIComponent(id)}`
    ),
};

export const escalations = {
  list: () => request<Ticket[]>("/api/escalations"),
};

export const dev = {
  reset: () =>
    request<{ message: string; seed_result: Record<string, unknown> }>(
      "/api/dev/reset",
      { method: "POST" }
    ),
};

export interface ChatScope {
  layer: Layer;
  id: string;
}

export interface ChatStreamHandlers {
  onDelta?: (text: string) => void;
  onDone?: (payload: { messageId: string; appliedTo: string[] }) => void;
  onError?: (err: unknown) => void;
  signal?: AbortSignal;
}

export const chat = {
  /**
   * SSE streaming chat. POST /api/chat returns text/event-stream.
   * Frames are delimited by `\n\n`; each frame has `event:` and `data:` lines.
   */
  stream: async (
    payload: { message: string; propertyId?: string; scope?: ChatScope },
    handlers: ChatStreamHandlers
  ): Promise<void> => {
    const url = buildUrl("/api/chat");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
      body: JSON.stringify(payload),
      signal: handlers.signal,
    });

    if (!res.ok || !res.body) {
      const env: ApiErrorEnvelope = {
        error: `Chat stream failed (${res.status})`,
        code: "HTTP_ERROR",
        status: res.status,
      };
      try {
        const parsed = await res.json();
        if (parsed && typeof parsed === "object" && "error" in parsed) {
          Object.assign(env, parsed);
        }
      } catch { /* ignore */ }
      throw new ApiError(env, "/api/chat");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          parseSseFrame(frame, handlers);
        }
      }
      if (buffer.trim().length > 0) parseSseFrame(buffer, handlers);
    } catch (err) {
      handlers.onError?.(err);
      throw err;
    }
  },
};

function parseSseFrame(frame: string, handlers: ChatStreamHandlers): void {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return;
  const raw = dataLines.join("\n");
  let parsed: any;
  try { parsed = JSON.parse(raw); } catch { parsed = { text: raw }; }

  if (event === "delta") handlers.onDelta?.(parsed.text ?? "");
  else if (event === "done") handlers.onDone?.({
    messageId: parsed.messageId,
    appliedTo: parsed.appliedTo ?? [],
  });
  else if (event === "error") handlers.onError?.(parsed);
}

export interface ExtractStartResponse {
  extractionId: string;
  status: "processing";
  pollUrl: string;
}

export interface ExtractDiff {
  layer: Layer;
  heading: string;
  before: string;
  after: string;
  rationale: string;
  confidence: number;
}

export interface ExtractResult {
  extractionId: string;
  status: "processing" | "done" | "error";
  proposedDiffs?: ExtractDiff[];
  error?: string;
}

export const extract = {
  start: async (file: File, opts?: { propertyId?: string; layer?: Layer }) => {
    const fd = new FormData();
    fd.append("file", file);
    if (opts?.propertyId) fd.append("propertyId", opts.propertyId);
    if (opts?.layer) fd.append("layer", opts.layer);

    const res = await fetch(buildUrl("/api/extract"), { method: "POST", body: fd });
    if (!res.ok) {
      throw new ApiError(
        { error: res.statusText || "Extract failed", code: "HTTP_ERROR", status: res.status },
        "/api/extract"
      );
    }
    return res.json() as Promise<ExtractStartResponse>;
  },
  poll: (extractionId: string) =>
    request<ExtractResult>(`/api/extract/${encodeURIComponent(extractionId)}`),
};

// ---------- aggregate ----------

export const api = {
  tickets,
  properties,
  context,
  owners,
  buildings,
  vendors,
  escalations,
  chat,
  extract,
  dev,
};
