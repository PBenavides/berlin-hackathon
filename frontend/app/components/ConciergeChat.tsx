"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface AttachmentOut {
  id: string;
  owner_message_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  vision_description: string | null;
  url: string;
  created_at: string;
}

export interface OwnerMessageOut {
  id: string;
  property_id: string;
  text: string;
  vision_text: string | null;
  agent_reply: string | null;
  agent_error: string | null;
  dispatch_id: string | null;
  latency_ms: number | null;
  created_at: string;
}

export interface MessageWithAttachments extends OwnerMessageOut {
  attachments: AttachmentOut[];
}

interface ConciergeChatProps {
  propertyId: string;
  propertyName: string;
  initialMessages: MessageWithAttachments[];
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ConciergeChat({
  propertyId,
  propertyName,
  initialMessages,
}: ConciergeChatProps) {
  const router = useRouter();
  const [messages, setMessages] =
    useState<MessageWithAttachments[]>(initialMessages);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() && files.length === 0) return;

    setSending(true);
    setError(null);

    const formData = new FormData();
    formData.append("text", text || "(image only)");
    for (const f of files) {
      formData.append("images", f);
    }

    try {
      const res = await fetch(
        `${API_BASE}/api/v1/properties/${propertyId}/messages`,
        { method: "POST", body: formData }
      );
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `HTTP ${res.status}`);
      }
      const result = await res.json();

      // Append the new message locally for instant feedback
      setMessages((prev) => [
        ...prev,
        {
          id: result.message_id,
          property_id: propertyId,
          text: text || "(image only)",
          vision_text: null,
          agent_reply: result.agent_reply,
          agent_error: result.agent_error,
          dispatch_id: result.dispatch_id,
          latency_ms: null,
          created_at: result.created_at,
          attachments: result.attachments || [],
        },
      ]);

      setText("");
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Refresh server data so any side-effects (audit, tickets) show up
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white">
        <h1 className="text-lg font-semibold text-slate-900">
          Concierge — {propertyName}
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Send messages and photos; the AI concierge replies.
          Phase 1: replies are stubbed until the Hermes dispatcher lands.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-slate-50">
        {messages.length === 0 && (
          <div className="text-center text-sm text-slate-400 py-12">
            No messages yet. Say hello below.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className="space-y-2">
            {/* Owner bubble (right) */}
            <div className="flex justify-end">
              <div className="max-w-[75%]">
                <div className="bg-brand-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {m.text}
                  </p>
                </div>
                {m.attachments.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-2 max-w-sm ml-auto">
                    {m.attachments.map((a) => (
                      <a
                        key={a.id}
                        href={`${API_BASE}${a.url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block group"
                      >
                        {a.mime_type.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`${API_BASE}${a.url}`}
                            alt={a.filename}
                            className="w-full h-24 object-cover rounded-lg border border-slate-200 group-hover:border-brand-400 transition-colors"
                          />
                        ) : (
                          <div className="w-full h-24 flex items-center justify-center text-xs text-slate-500 bg-white border border-slate-200 rounded-lg">
                            📎 {a.filename}
                          </div>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1 truncate">
                          {a.filename} · {fileSize(a.size_bytes)}
                        </p>
                      </a>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-slate-400 mt-1 text-right">
                  {formatTime(m.created_at)}
                </p>
              </div>
            </div>

            {/* Agent bubble (left) */}
            {(m.agent_reply || m.agent_error) && (
              <div className="flex justify-start">
                <div className="max-w-[75%]">
                  <div
                    className={`rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm border ${
                      m.agent_error
                        ? "bg-red-50 border-red-200 text-red-900"
                        : "bg-white border-slate-200 text-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        {m.agent_error ? "Concierge error" : "Concierge"}
                      </span>
                      {m.dispatch_id && (
                        <span className="text-[10px] text-slate-300 font-mono">
                          · {m.dispatch_id.slice(0, 8)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {m.agent_error || m.agent_reply}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={sendMessage}
        className="border-t border-slate-200 bg-white px-6 py-4"
      >
        {error && (
          <div className="mb-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <span
                key={i}
                className="text-xs bg-slate-100 text-slate-700 rounded-full px-2.5 py-1 flex items-center gap-1.5"
              >
                📷 {f.name} · {fileSize(f.size)}
                <button
                  type="button"
                  onClick={() =>
                    setFiles((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  className="text-slate-400 hover:text-slate-700"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="flex-shrink-0 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
            title="Attach images"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const list = e.target.files;
              if (list) setFiles(Array.from(list));
            }}
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(e as unknown as FormEvent);
              }
            }}
            placeholder="Describe an issue, attach a photo… (Shift+Enter for newline)"
            rows={1}
            disabled={sending}
            className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || (!text.trim() && files.length === 0)}
            className="flex-shrink-0 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
