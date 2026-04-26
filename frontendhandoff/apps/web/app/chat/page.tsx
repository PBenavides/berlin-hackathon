"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@repo/ui/components/card";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { api, friendlyApiError } from "@/lib/api";
import { useToast } from "@/components/toaster";
import type { Property } from "@/lib/types";
import { Send, Square, Loader2, MessageSquareText } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  pending?: boolean;
}

export default function ChatPage() {
  const { push: pushToast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.properties.list()
      .then((list) => {
        if (cancelled) return;
        setProperties(list);
        if (list.length > 0 && !propertyId) setPropertyId(list[0].id);
      })
      .catch(() => { /* leave list empty */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text };
    const assistantId = `a-${Date.now()}`;
    setMessages((m) => [...m, userMsg, { id: assistantId, role: "assistant", text: "", pending: true }]);

    const ctl = new AbortController();
    abortRef.current = ctl;
    setStreaming(true);

    const reportError = (err: unknown) => {
      const friendly = friendlyApiError(err, "chat");
      pushToast({ ...friendly, variant: "destructive" });
      setMessages((m) =>
        m.map((mm) => mm.id === assistantId ? {
          ...mm,
          pending: false,
          text: mm.text || `[${friendly.title}${friendly.description ? `: ${friendly.description}` : ""}]`,
        } : mm)
      );
    };

    try {
      await api.chat.stream(
        {
          message: text,
          propertyId: propertyId || undefined,
          scope: propertyId ? { layer: "property", id: propertyId } : undefined,
        },
        {
          signal: ctl.signal,
          onDelta: (delta) => {
            setMessages((m) =>
              m.map((msg) => msg.id === assistantId ? { ...msg, text: msg.text + delta } : msg)
            );
          },
          onDone: () => {
            setMessages((m) =>
              m.map((msg) => msg.id === assistantId ? { ...msg, pending: false } : msg)
            );
          },
          onError: reportError,
        }
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setMessages((m) =>
          m.map((mm) => mm.id === assistantId ? { ...mm, pending: false, text: mm.text || "[aborted]" } : mm)
        );
      } else {
        reportError(err);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function abort() {
    abortRef.current?.abort();
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Hermes Chat"
        subtitle="Streaming Q&A scoped to a property's context.md"
        actions={
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-sm"
          >
            <option value="">No scope</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        }
      />

      <div className="flex flex-1 flex-col gap-4 p-8">
        <Card className="flex-1">
          <CardContent className="flex h-full flex-col p-0">
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                  <MessageSquareText className="h-6 w-6" />
                  Ask Hermes about the selected property's context.
                </div>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex w-full",
                    m.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                      m.role === "user"
                        ? "bg-foreground text-background"
                        : "border bg-card text-foreground"
                    )}
                  >
                    {m.text}
                    {m.pending && (
                      <Loader2 className="ml-2 inline h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 border-t p-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="Ask Hermes…"
                disabled={streaming}
              />
              {streaming ? (
                <Button variant="outline" onClick={abort}>
                  <Square className="h-4 w-4" />
                  Stop
                </Button>
              ) : (
                <Button onClick={() => void send()} disabled={!input.trim()}>
                  <Send className="h-4 w-4" />
                  Send
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
