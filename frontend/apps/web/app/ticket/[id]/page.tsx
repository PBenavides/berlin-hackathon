"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@repo/ui/components/card";
import { Button } from "@repo/ui/components/button";
import { Badge } from "@repo/ui/components/badge";
import { Separator } from "@repo/ui/components/separator";
import { RiskBadge, StatusBadge } from "@/components/badges";
import { useToast } from "@/components/toaster";
import { api, ApiError, friendlyApiError } from "@/lib/api";
import { emit } from "@/lib/bus";
import type { Property, Ticket, Vendor } from "@/lib/types";
import { formatEur, timeAgo } from "@/lib/utils";
import { cn } from "@repo/ui/lib/utils";
import {
  Phone, Mail, ChevronDown, ChevronRight, Check, Sparkles,
  CheckCircle2, Clock, MessageSquare, Wrench, FileEdit, Loader2,
} from "lucide-react";

type Mutation = "approve" | "reject" | "saveMemory" | "skipMemory";

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { push: pushToast } = useToast();

  const [t, setTicket] = useState<Ticket | null>(null);
  const [prop, setProp] = useState<Property | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutating, setMutating] = useState<Mutation | null>(null);

  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [reasoningOpen, setReasoningOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTicket(null);
    setProp(null);
    setVendor(null);
    setLoadError(null);
    (async () => {
      try {
        const ticket = await api.tickets.get(id);
        if (cancelled) return;
        setTicket(ticket);
        const [property, v] = await Promise.all([
          api.properties.get(ticket.propertyId),
          ticket.proposal ? api.vendors.get(ticket.proposal.proposedAction.vendorId) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setProp(property);
        setVendor(v);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          notFound();
          return;
        }
        setLoadError(err instanceof Error ? err.message : "Failed to load ticket");
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  async function runMutation(
    kind: Mutation,
    fn: () => Promise<void>,
  ) {
    setMutating(kind);
    try {
      await fn();
    } catch (err) {
      const friendly = friendlyApiError(err, kind);
      pushToast({ ...friendly, variant: "destructive" });
    } finally {
      setMutating(null);
    }
  }

  async function refetchTicket(): Promise<Ticket | null> {
    try {
      const fresh = await api.tickets.get(id);
      setTicket(fresh);
      return fresh;
    } catch (err) {
      const friendly = friendlyApiError(err, "load");
      pushToast({ ...friendly, variant: "destructive" });
      return null;
    }
  }

  async function handleApprove() {
    if (!t) return;
    await runMutation("approve", async () => {
      await api.tickets.approve(t.id);
      const fresh = await refetchTicket();
      pushToast({
        title: "Dispatch approved",
        description: fresh?.vendorJob ? `SLA timer started · status ${fresh.status}` : "SMS sent to vendor.",
        variant: "success",
      });
      emit({ kind: "ticket-changed", ticketId: t.id, propertyId: t.propertyId });
      router.refresh();
    });
  }

  async function handleReject() {
    if (!t) return;
    await runMutation("reject", async () => {
      await api.tickets.reject(t.id);
      await refetchTicket();
      pushToast({ title: "Proposal rejected" });
      emit({ kind: "ticket-changed", ticketId: t.id, propertyId: t.propertyId });
      router.refresh();
    });
  }

  async function handleSaveMemory() {
    if (!t || !t.memoryProposal) return;
    await runMutation("saveMemory", async () => {
      const result = await api.tickets.saveMemory(t.id);
      await refetchTicket();
      pushToast({
        title: "Memory saved",
        description: `context.md bumped to v${result.contextVersion}`,
        variant: "success",
      });
      emit({ kind: "context-bumped", propertyId: t.propertyId, version: result.contextVersion });
      emit({ kind: "ticket-changed", ticketId: t.id, propertyId: t.propertyId });
      router.refresh();
    });
  }

  async function handleSkipMemory() {
    if (!t || !t.memoryProposal) return;
    await runMutation("skipMemory", async () => {
      await api.tickets.skipMemory(t.id);
      await refetchTicket();
      pushToast({ title: "Memory write skipped" });
      emit({ kind: "ticket-changed", ticketId: t.id, propertyId: t.propertyId });
      router.refresh();
    });
  }

  if (loadError) {
    return <div className="p-8 text-sm text-destructive">{loadError}</div>;
  }
  if (!t) {
    return <TicketDetailSkeleton />;
  }

  const isApproved = t.status !== "proposed" && t.status !== "new" && t.status !== "triaged" && t.status !== "rejected";
  const memorySaved = t.memoryProposal?.status === "saved";
  const memorySkipped = t.memoryProposal?.status === "skipped";
  const showMemoryDecision =
    !!t.memoryProposal &&
    t.memoryProposal.status === "pending" &&
    !!t.vendorJob?.completedAt;

  return (
    <div>
      <PageHeader
        title={t.subject}
        subtitle={`${prop?.name ?? ""} · ${t.raisedBy} · ${timeAgo(t.createdAt)} ago`}
        crumbs={[{ label: "Properties" }, { label: prop?.name ?? "", href: prop ? `/property/${prop.id}/tickets` : undefined }, { label: t.num }]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={t.status} />
            <RiskBadge risk={t.risk} />
            <span className="font-mono text-xs text-muted-foreground">{t.num}</span>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-6 p-8">
        {/* LEFT 2/3 — proposal-first */}
        <div className="col-span-2 space-y-4">
          {/* Proposal card (only shown when proposed) */}
          {t.proposal && (
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider text-blue-500 dark:text-blue-400">
                    Proposed action <span className="ml-2 font-mono text-muted-foreground">{t.proposal.id}</span>
                  </div>
                  <Badge variant="muted" className="font-mono">conf {Math.round(t.proposal.confidence * 100)}%</Badge>
                </div>

                {/* Action — vendor / cost / ETA */}
                <div className="mb-4 flex items-start justify-between gap-6">
                  <div className="min-w-0 flex-1">
                    <div className="text-xl font-semibold">{t.proposal.proposedAction.vendor}</div>
                    <div className="text-sm text-muted-foreground">
                      {t.proposal.proposedAction.trade} · {t.proposal.proposedAction.target}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-stretch gap-2">
                    <div className="rounded-md border bg-background px-3 py-2 text-center">
                      <div className="text-lg font-semibold leading-none">{formatEur(t.proposal.proposedAction.estimateEur)}</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">estimate</div>
                    </div>
                    <div className="rounded-md border bg-background px-3 py-2 text-center">
                      <div className="text-lg font-semibold leading-none">{t.proposal.proposedAction.etaHours}h</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">ETA</div>
                    </div>
                  </div>
                </div>

                {/* Policy chips */}
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {t.proposal.policiesEvaluated.map((p) => (
                    <Badge key={p.code} variant={p.passed ? "success" : "destructive"} className="font-normal">
                      {p.passed ? "✓" : "✗"} {p.name}
                    </Badge>
                  ))}
                </div>

                {/* Consequences */}
                <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/8 p-4">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Approving will:</div>
                  <ul className="space-y-1.5 text-sm">
                    <li className="flex gap-2"><span>→</span><span>Dispatch <strong>{t.proposal.proposedAction.vendor}</strong> to {t.proposal.proposedAction.target}</span></li>
                    <li className="flex gap-2"><span>→</span><span>Send written confirmation to {t.raisedBy} <em>(Sie-Form, mobility flag respected)</em></span></li>
                    <li className="flex gap-2"><span>→</span><span>Send SMS dispatch to {vendor?.name ?? t.proposal.proposedAction.vendor} ({vendor?.phone ?? "—"}) — {vendor?.slaHours ?? t.proposal.proposedAction.etaHours}h SLA timer starts</span></li>
                    <li className="flex gap-2 text-muted-foreground"><span>→</span><span>Memory write happens <strong>after</strong> vendor reports completion (not now)</span></li>
                  </ul>
                </div>

                {/* Action row */}
                {!isApproved && t.status === "proposed" ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="success"
                      className="flex-1"
                      onClick={handleApprove}
                      disabled={mutating !== null}
                    >
                      {mutating === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Approve dispatch
                    </Button>
                    <Button variant="outline" disabled={mutating !== null}>Edit</Button>
                    <Button
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={handleReject}
                      disabled={mutating !== null}
                    >
                      {mutating === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Reject
                    </Button>
                  </div>
                ) : isApproved ? (
                  <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                    <div className="flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      Dispatch approved · SMS sent to {vendor?.name ?? t.proposal.proposedAction.vendor} · Email sent to {t.raisedBy}
                    </div>
                    <div className="mt-1 text-xs text-emerald-600/80 dark:text-emerald-400/80">
                      SLA timer started ({vendor?.slaHours ?? t.proposal.proposedAction.etaHours}h). Status: <strong>{t.status}</strong>. No memory write yet.
                    </div>
                  </div>
                ) : t.status === "rejected" ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                    Proposal rejected.
                  </div>
                ) : null}

                {/* Reasoning collapsed by default */}
                <button
                  onClick={() => setReasoningOpen((o) => !o)}
                  className="mt-4 flex w-full items-center justify-between rounded-md border-t pt-3 text-left text-sm hover:bg-accent/50"
                >
                  <span className="font-medium">Reasoning & evidence <span className="ml-1 font-mono text-xs text-muted-foreground">cites context.md v{t.proposal.contextVersion}</span></span>
                  {reasoningOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                {reasoningOpen && (
                  <div className="mt-3 space-y-3 text-sm">
                    <p className="text-muted-foreground">{t.proposal.reasoning}</p>
                    <div className="space-y-2">
                      {t.proposal.citations.map((c, i) => (
                        <div key={i} className="rounded border-l-2 border-blue-300 bg-background px-3 py-2">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{c.heading}</div>
                          <div className="text-sm">{c.excerpt}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Vendor job status (when in flight or completed) */}
          {t.vendorJob && (
            <Card>
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Vendor job</h3>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex justify-between"><span className="text-muted-foreground">Sent</span><span>{new Date(t.vendorJob.sentAt).toLocaleString("de-DE")}</span></li>
                  <li className="flex justify-between"><span className="text-muted-foreground">Accepted</span><span>{t.vendorJob.accepted ? "Yes" : "Pending"}</span></li>
                  {t.vendorJob.scheduledFor && <li className="flex justify-between"><span className="text-muted-foreground">Scheduled</span><span>{new Date(t.vendorJob.scheduledFor).toLocaleString("de-DE")}</span></li>}
                  {t.vendorJob.completedAt && <li className="flex justify-between"><span className="text-muted-foreground">Completed</span><span>{new Date(t.vendorJob.completedAt).toLocaleString("de-DE")}</span></li>}
                  {t.vendorJob.finalCostEur != null && <li className="flex justify-between"><span className="text-muted-foreground">Final cost</span><span className="font-medium">{formatEur(t.vendorJob.finalCostEur)}</span></li>}
                  {t.vendorJob.notes && <li className="text-muted-foreground">"{t.vendorJob.notes}"</li>}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* MEMORY DECISION — only after vendor completion AND status === pending */}
          {showMemoryDecision && (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="p-5">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-500" />
                  <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Memory decision · vendor closed the job</div>
                </div>
                <p className="mb-3 text-sm">
                  Save to <code className="font-mono text-xs">context.md v{t.memoryProposal!.targetVersion}</code>:
                </p>
                <blockquote className="mb-4 rounded border-l-2 border-emerald-400 bg-background px-3 py-2 text-sm">
                  {t.memoryProposal!.text}
                </blockquote>
                <div className="flex gap-2">
                  <Button variant="success" onClick={handleSaveMemory} disabled={mutating !== null}>
                    {mutating === "saveMemory" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Save to memory
                  </Button>
                  <Button variant="outline" disabled={mutating !== null}><FileEdit className="h-4 w-4" />Edit</Button>
                  <Button variant="ghost" onClick={handleSkipMemory} disabled={mutating !== null}>
                    {mutating === "skipMemory" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Skip
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {memorySaved && (
            <Card className="border-emerald-500/40 bg-emerald-500/10">
              <CardContent className="p-4 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="mr-2 inline h-4 w-4" />
                Memory saved to <code className="font-mono text-xs">context.md v{t.memoryProposal?.targetVersion}</code>. Ticket resolved.
              </CardContent>
            </Card>
          )}

          {memorySkipped && (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                Memory write skipped. Ticket closed without context update.
              </CardContent>
            </Card>
          )}

          {/* SOURCE — call transcript or email */}
          {t.callSession && (
            <Card>
              <CardContent className="p-5">
                <button
                  onClick={() => setTranscriptOpen((o) => !o)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Call transcript</span>
                    <Badge variant="muted" className="font-mono">{t.callSession.duration}</Badge>
                    <span className="text-xs text-muted-foreground">noise reduction {t.callSession.noiseReductionDb} dB</span>
                  </div>
                  {transcriptOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                {!transcriptOpen && (
                  <p className="mt-2 text-sm text-muted-foreground">{t.callSession.summary}</p>
                )}
                {transcriptOpen && (
                  <div className="mt-4 space-y-2 max-h-80 overflow-auto rounded border bg-muted/20 p-3">
                    {t.callSession.transcript.map((line, i) => (
                      <div key={i} className={cn("flex gap-3 text-sm", line.spk === "tenant" ? "" : "text-muted-foreground")}>
                        <span className="w-12 shrink-0 font-mono text-[10px] text-muted-foreground">{line.t}</span>
                        <span className="w-14 shrink-0 text-[10px] uppercase">{line.spk}</span>
                        <div className="flex-1">
                          <div>{line.text}</div>
                          <div className="text-[11px] italic text-muted-foreground">{line.en}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {t.emailBody && (
            <Card>
              <CardContent className="p-5">
                <div className="mb-2 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Email</span>
                </div>
                <pre className="whitespace-pre-wrap text-sm font-sans">{t.emailBody}</pre>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT 1/3 — context */}
        <aside className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Property</div>
              <Link href={prop ? `/property/${prop.id}/context` : "#"} className="mt-1 block text-sm font-medium hover:underline">
                {prop?.name ?? "—"}
              </Link>
              <div className="mt-1 text-xs text-muted-foreground">context.md v{prop?.contextVersion ?? "—"}</div>
              <Separator className="my-3" />
              <div className="space-y-1 text-xs">
                <div><span className="text-muted-foreground">Phone: </span>{prop?.phone ?? "—"}</div>
                <div><span className="text-muted-foreground">Email: </span>{prop?.email ?? "—"}</div>
                <div><span className="text-muted-foreground">Open tickets: </span>{prop?.openTickets ?? "—"}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Activity</div>
              <ul className="mt-2 space-y-2 text-xs">
                <li className="flex gap-2"><Clock className="mt-0.5 h-3 w-3 text-muted-foreground" /><span>Ticket opened — {timeAgo(t.createdAt)} ago</span></li>
                <li className="flex gap-2"><MessageSquare className="mt-0.5 h-3 w-3 text-muted-foreground" /><span>Triage agent classified</span></li>
                {t.proposal && <li className="flex gap-2"><Sparkles className="mt-0.5 h-3 w-3 text-blue-500 dark:text-blue-400" /><span>Hermes proposed action</span></li>}
                {isApproved && <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3 w-3 text-emerald-700" /><span>Operator approved</span></li>}
                {t.vendorJob?.completedAt && <li className="flex gap-2"><Wrench className="mt-0.5 h-3 w-3 text-emerald-700" /><span>Vendor reported completion</span></li>}
                {memorySaved && <li className="flex gap-2"><Sparkles className="mt-0.5 h-3 w-3 text-emerald-700" /><span>Memory committed to v{t.memoryProposal?.targetVersion}</span></li>}
              </ul>
            </CardContent>
          </Card>

          {vendor && (
            <Card>
              <CardContent className="p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proposed vendor</div>
                <Link href={`/vendor/${vendor.id}`} className="mt-1 block text-sm font-medium hover:underline">{vendor.name}</Link>
                <div className="mt-2 space-y-1 text-xs">
                  <div><span className="text-muted-foreground">Trade: </span>{vendor.trade}</div>
                  <div><span className="text-muted-foreground">Rating: </span>{vendor.rating} / 5</div>
                  <div><span className="text-muted-foreground">SLA: </span>{vendor.slaHours}h</div>
                  <div><span className="text-muted-foreground">Phone: </span>{vendor.phone}</div>
                </div>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function TicketDetailSkeleton() {
  return (
    <div className="p-8">
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="h-48 animate-pulse rounded-lg border bg-muted/30" />
          <div className="h-32 animate-pulse rounded-lg border bg-muted/30" />
        </div>
        <aside className="space-y-4">
          <div className="h-32 animate-pulse rounded-lg border bg-muted/30" />
          <div className="h-32 animate-pulse rounded-lg border bg-muted/30" />
        </aside>
      </div>
    </div>
  );
}
