import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@repo/ui/components/card";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { RiskBadge } from "@/components/badges";
import { api } from "@/lib/api";
import { pipelineStages } from "@/lib/pipeline";
import { timeAgo, formatEur } from "@/lib/utils";
import { Phone, Mail, AlertTriangle, ArrowRight } from "lucide-react";

export default async function OverviewPage() {
  const [tickets, properties] = await Promise.all([
    api.tickets.list(),
    api.properties.list(),
  ]);

  const unsolved = tickets.filter((t) => !["resolved", "rejected"].includes(t.status));
  const proposed = tickets.filter((t) => t.status === "proposed");
  const completed = tickets.filter((t) => t.status === "completed");

  const kpis: Array<{ label: string; value: number; accent?: "amber" | "emerald" }> = [
    { label: "Awaiting your approval", value: proposed.length, accent: "amber" },
    { label: "In flight",              value: unsolved.filter((t) => ["awaiting_vendor", "scheduled", "in_progress"].includes(t.status)).length },
    { label: "Memory writes pending",  value: completed.length, accent: "emerald" },
    { label: "Resolved last 7d",       value: 12 },
  ];

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="Pipeline across all properties"
        actions={
          <Button variant="outline" size="sm">
            Last 24h
          </Button>
        }
      />

      <div className="space-y-6 p-8">
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-4">
          {kpis.map((k) => (
            <Card key={k.label}>
              <CardContent className="p-5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</div>
                <div className={`mt-2 text-3xl font-semibold ${k.accent === "amber" ? "text-amber-700" : k.accent === "emerald" ? "text-emerald-700" : ""}`}>
                  {k.value}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pipeline */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pipeline</h2>
          <div className="grid grid-cols-6 gap-3">
            {pipelineStages.map((stage) => {
              const stageTickets = tickets.filter((t) => t.status === stage.id);
              return (
                <div key={stage.id} className="rounded-lg border bg-background p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-medium">{stage.label}</div>
                    <span className="rounded bg-muted px-1.5 text-[11px] font-mono">{stageTickets.length}</span>
                  </div>
                  <p className="mb-3 text-[11px] leading-snug text-muted-foreground">{stage.description}</p>
                  <div className="space-y-2">
                    {stageTickets.map((t) => {
                      const prop = properties.find((p) => p.id === t.propertyId);
                      return (
                        <Link
                          key={t.id}
                          href={`/ticket/${t.id}`}
                          className="block rounded border bg-card p-2 hover:border-foreground/40"
                        >
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span className="font-mono">{t.num}</span>
                            <RiskBadge risk={t.risk} />
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs font-medium">{t.subject}</div>
                          <div className="mt-1 text-[10px] text-muted-foreground">{prop?.name}</div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Awaiting approval — call to action */}
        {proposed.length > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <h3 className="text-sm font-semibold">Awaiting your approval ({proposed.length})</h3>
              </div>
              <div className="space-y-2">
                {proposed.map((t) => {
                  const prop = properties.find((p) => p.id === t.propertyId);
                  return (
                    <Link
                      key={t.id}
                      href={`/ticket/${t.id}`}
                      className="flex items-center justify-between rounded-md border bg-background p-3 hover:border-foreground/40"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {t.source === "voice" ? <Phone className="h-3.5 w-3.5 text-muted-foreground" /> : <Mail className="h-3.5 w-3.5 text-muted-foreground" />}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <span className="truncate">{t.subject}</span>
                            <RiskBadge risk={t.risk} />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {prop?.name} · {t.raisedBy} · {timeAgo(t.createdAt)} ago
                            {t.proposal && <> · proposes {t.proposal.proposedAction.vendor} · {formatEur(t.proposal.proposedAction.estimateEur)}</>}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Memory writes pending */}
        {completed.length > 0 && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-5">
              <div className="mb-3">
                <h3 className="text-sm font-semibold">Memory writes pending — vendor closed the job</h3>
                <p className="text-xs text-muted-foreground">Memory is only proposed AFTER work completes — not at dispatch.</p>
              </div>
              <div className="space-y-2">
                {completed.map((t) => {
                  const prop = properties.find((p) => p.id === t.propertyId);
                  return (
                    <Link
                      key={t.id}
                      href={`/ticket/${t.id}`}
                      className="flex items-center justify-between rounded-md border bg-background p-3 hover:border-foreground/40"
                    >
                      <div>
                        <div className="text-sm font-medium">{t.subject}</div>
                        <div className="text-xs text-muted-foreground">
                          {prop?.name} · final cost {t.vendorJob && formatEur(t.vendorJob.finalCostEur ?? 0)} · save to v{t.memoryProposal?.targetVersion}?
                        </div>
                      </div>
                      <Badge variant="success">memory pending</Badge>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
