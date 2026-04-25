"use client";

import { use } from "react";
import Link from "next/link";
import { useState } from "react";
import { Card, CardContent } from "@repo/ui/components/card";
import { Button } from "@repo/ui/components/button";
import { RiskBadge, StatusBadge } from "@/components/badges";
import { tickets } from "@/lib/data";
import { timeAgo, formatEur } from "@/lib/utils";
import { Phone, Mail, ArrowUpDown } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

type Filter = "unsolved" | "all" | "resolved";

export default function PropertyTicketsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [filter, setFilter] = useState<Filter>("unsolved");
  const propTickets = tickets.filter((t) => t.propertyId === id);
  const counts = {
    unsolved: propTickets.filter((t) => !["resolved", "rejected"].includes(t.status)).length,
    all: propTickets.length,
    resolved: propTickets.filter((t) => ["resolved", "rejected"].includes(t.status)).length,
  };
  const filtered =
    filter === "unsolved" ? propTickets.filter((t) => !["resolved", "rejected"].includes(t.status))
    : filter === "resolved" ? propTickets.filter((t) => ["resolved", "rejected"].includes(t.status))
    : propTickets;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-lg border bg-background p-1">
          {(["unsolved", "all", "resolved"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-3 py-1 text-sm capitalize transition-colors",
                filter === f ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f} <span className="ml-1 font-mono text-xs opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm">
          <ArrowUpDown className="h-3 w-3" />
          Newest
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No tickets in this view.</div>
          ) : (
            <ul className="divide-y">
              {filtered.map((t) => (
                <li key={t.id} className={cn(t.status === "proposed" && "bg-amber-500/5")}>
                  <Link href={`/ticket/${t.id}`} className="flex items-start gap-3 p-4 hover:bg-accent">
                    <div className="mt-0.5">
                      {t.source === "voice" ? <Phone className="h-4 w-4 text-muted-foreground" /> : <Mail className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{t.subject}</span>
                        <StatusBadge status={t.status} />
                        <RiskBadge risk={t.risk} />
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        {t.raisedBy} · {timeAgo(t.createdAt)} ago
                        {t.proposal && <> · proposes {t.proposal.proposedAction.vendor} · {formatEur(t.proposal.proposedAction.estimateEur)}</>}
                      </p>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">{t.num}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
