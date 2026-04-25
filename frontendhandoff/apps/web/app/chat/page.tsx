"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@repo/ui/components/card";
import { Button } from "@repo/ui/components/button";
import { Badge } from "@repo/ui/components/badge";
import { Input } from "@repo/ui/components/input";
import { allAgents } from "@/lib/agents";
import { Sparkles, Send } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

export default function ChatPage() {
  const [activeAgentId, setActiveAgentId] = useState("hermes");
  const active = allAgents.find((a) => a.id === activeAgentId)!;

  const SAMPLE_MESSAGES = [
    { role: "user",      content: "What's pending my approval?" },
    { role: "assistant", content: "Two proposals are awaiting you:\n\n1. **GAR-118** Heating cold Unit 3B — dispatch Heinz GmbH €175 (24h ETA, mobility flag).\n2. **GAR-117** Drain slow Unit 5C — dispatch Wasser Schmidt €145 (8h ETA).\n\nBoth pass policy. Confidence 86% / 91%. Want me to walk through GAR-118?" },
  ];

  return (
    <div>
      <PageHeader title="Hermes Chat" subtitle="Talk to the orchestrator. Route to specialists. Inspect prompts." />
      <div className="grid grid-cols-3 gap-6 p-8">
        {/* Chat */}
        <div className="col-span-2 space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="border-b p-4">
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-md bg-emerald-600 text-white">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Hermes</div>
                    <div className="text-xs text-muted-foreground">Orchestrator · v3.2 · routing across all 4 layers</div>
                  </div>
                </div>
              </div>
              <div className="space-y-4 p-4 min-h-[400px]">
                {SAMPLE_MESSAGES.map((m, i) => (
                  <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "")}>
                    <div className={cn(
                      "max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                      m.role === "user" ? "bg-foreground text-background" : "bg-muted"
                    )}>
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t p-3">
                <div className="flex gap-2">
                  <Input placeholder="Ask Hermes…" />
                  <Button><Send className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agents + system prompts */}
        <aside className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agents</div>
          <div className="space-y-1">
            {allAgents.map((a) => (
              <button
                key={a.id}
                onClick={() => setActiveAgentId(a.id)}
                className={cn(
                  "block w-full rounded-md border p-2 text-left text-sm hover:bg-accent",
                  activeAgentId === a.id && "border-foreground bg-accent"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{a.name}</span>
                  <Badge variant="muted" className="font-mono text-[10px]">{a.version}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{a.role}</div>
              </button>
            ))}
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">System prompt</div>
                <Badge variant="muted" className="font-mono text-[10px]">{active.model}</Badge>
              </div>
              <div className="mb-2 text-xs text-muted-foreground">Scope: {active.layerScope}</div>
              <div className="mb-2 flex flex-wrap gap-1">
                {active.tools.map((t) => <Badge key={t} variant="outline" className="font-mono text-[10px]">{t}</Badge>)}
              </div>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded border bg-muted/30 p-3 text-[11px] leading-relaxed">{active.prompt}</pre>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
