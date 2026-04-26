"use client";

/**
 * ActionCard — displays a single agent action as a streaming card in the ticket detail page.
 *
 * Status lifecycle:
 *   thinking  → animated spinner (agent is calling the tool)
 *   completed → checkmark (read tool returned data)
 *   proposed  → action-specific UI with confirm/reject (write tool proposal)
 *   confirmed → green confirmed badge
 *   rejected  → muted rejected badge
 */

import { useState, useEffect } from "react";
import { Card, CardContent } from "@repo/ui/components/card";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import {
  Loader2,
  Check,
  CheckCircle2,
  XCircle,
  Search,
  Mail,
  MessageSquare,
  FileBarChart2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  User,
  Wrench,
  Brain,
} from "lucide-react";
import type { AgentAction, ActionProposalEnvelope } from "@/lib/types";
import { confirmAction, friendlyApiError } from "@/lib/api";
import { useToast } from "@/components/toaster";

// ---------------------------------------------------------------------------
// Icon mapping per tool / action type
// ---------------------------------------------------------------------------
function ActionIcon({ toolName, className }: { toolName: string | null; className?: string }) {
  const cls = cn("h-4 w-4", className);
  switch (toolName) {
    case "send_vendor_email":        return <Mail className={cls} />;
    case "respond_to_tenant":        return <MessageSquare className={cls} />;
    case "send_owner_report":        return <FileBarChart2 className={cls} />;
    case "escalate_to_human":        return <AlertTriangle className={cls} />;
    case "approve_ticket":
    case "reject_ticket":            return <Wrench className={cls} />;
    case "get_property_context":
    case "get_property":             return <Brain className={cls} />;
    case "get_vendor":
    case "list_vendors":             return <Wrench className={cls} />;
    case "get_owner":                return <User className={cls} />;
    case "list_tickets":
    case "get_ticket":
    case "list_escalations":         return <Search className={cls} />;
    default:                         return <Search className={cls} />;
  }
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------
function StatusBadgeLocal({ status }: { status: AgentAction["status"] }) {
  switch (status) {
    case "thinking":
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> thinking…
        </span>
      );
    case "completed":
      return (
        <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" /> done
        </span>
      );
    case "proposed":
      return <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600">proposed</Badge>;
    case "confirmed":
      return <Badge variant="success" className="text-xs">confirmed</Badge>;
    case "rejected":
      return <Badge variant="muted" className="text-xs line-through">rejected</Badge>;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Proposal detail rendering (action-type specific)
// ---------------------------------------------------------------------------
function ProposalDetail({ proposal, toolName }: {
  proposal: ActionProposalEnvelope;
  toolName: string | null;
}) {
  if (toolName === "send_vendor_email" && proposal.email) {
    const e = proposal.email;
    return (
      <div className="mt-3 rounded-md border bg-background p-3 text-sm">
        <div className="mb-1 text-xs text-muted-foreground">
          <span className="font-medium">To:</span> {e.vendorName} &lt;{e.to}&gt;
        </div>
        <div className="mb-2 text-xs text-muted-foreground">
          <span className="font-medium">Subject:</span> {e.subject}
        </div>
        <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">{e.body}</pre>
      </div>
    );
  }

  if (toolName === "respond_to_tenant" && proposal.response) {
    const r = proposal.response;
    return (
      <div className="mt-3 rounded-md border bg-background p-3 text-sm">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="muted" className="text-xs">{r.channelLabel}</Badge>
          <span>to {r.tenantName}</span>
        </div>
        <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">{r.body}</pre>
      </div>
    );
  }

  if (toolName === "send_owner_report" && proposal.report) {
    const r = proposal.report;
    return (
      <div className="mt-3 rounded-md border bg-background p-3 text-sm">
        <div className="mb-1 text-xs text-muted-foreground">
          <span className="font-medium">To:</span> {r.ownerName} &lt;{r.recipient}&gt;
        </div>
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="muted" className="text-xs">{r.formatLabel}</Badge>
        </div>
        <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">{r.content}</pre>
      </div>
    );
  }

  if (toolName === "escalate_to_human" && proposal.escalation) {
    const e = proposal.escalation;
    return (
      <div className="mt-3 space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-destructive/80">Reason</div>
          <p className="text-sm">{e.reason}</p>
        </div>
        {e.triggeringPolicy && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Triggering policy</div>
            <p className="text-sm text-muted-foreground">{e.triggeringPolicy}</p>
          </div>
        )}
        {e.recommendation && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recommended action</div>
            <p className="text-sm">{e.recommendation}</p>
          </div>
        )}
      </div>
    );
  }

  // Fallback: show raw label
  return null;
}

// ---------------------------------------------------------------------------
// Main ActionCard component
// ---------------------------------------------------------------------------
interface ActionCardProps {
  action: AgentAction;
  onConfirmed?: (actionId: string) => void;
  onRejected?: (actionId: string) => void;
  className?: string;
}

export function ActionCard({ action, onConfirmed, onRejected, className }: ActionCardProps) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [localStatus, setLocalStatus] = useState(action.status);
  const { push: pushToast } = useToast();

  // Bug-004 fix: sync localStatus when the parent re-renders with an updated status
  // (e.g., action_proposal SSE fires and parent updates action.status from "thinking" → "proposed")
  useEffect(() => {
    // Only sync upward transitions — don't overwrite user-confirmed/rejected state
    if (localStatus !== "confirmed" && localStatus !== "rejected") {
      setLocalStatus(action.status);
    }
  }, [action.status]);

  const proposal = action.payload?.proposal as ActionProposalEnvelope | undefined;
  const isProposed = localStatus === "proposed";
  const isRead = action.actionType === "read";
  const isWrite = !isRead && action.actionType !== "write_proposal";
  const hasConfirmEndpoint = !!proposal?.confirmEndpoint;

  async function handleConfirm() {
    if (!proposal?.confirmEndpoint) return;
    setConfirming(true);
    try {
      await confirmAction(proposal);
      setLocalStatus("confirmed");
      pushToast({ title: "Action confirmed", variant: "success" });
      onConfirmed?.(action.id);
    } catch (err) {
      const { title, description } = friendlyApiError(err, "approve");
      pushToast({ title, description, variant: "destructive" });
    } finally {
      setConfirming(false);
    }
  }

  function handleReject() {
    setLocalStatus("rejected");
    onRejected?.(action.id);
  }

  // Border/bg color by action type
  const cardVariant = cn(
    "transition-all duration-300",
    action.toolName === "escalate_to_human" && localStatus !== "rejected"
      ? "border-destructive/30 bg-destructive/5"
      : action.toolName === "send_vendor_email" ||
        action.toolName === "respond_to_tenant" ||
        action.toolName === "send_owner_report"
      ? "border-amber-500/30 bg-amber-500/5"
      : isRead
      ? "border-border/50 bg-muted/20"
      : "border-blue-500/20 bg-blue-500/5",
    className
  );

  return (
    <Card className={cardVariant}>
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
              isRead ? "bg-muted text-muted-foreground" :
              action.toolName === "escalate_to_human" ? "bg-destructive/10 text-destructive" :
              "bg-amber-500/10 text-amber-600"
            )}>
              <ActionIcon toolName={action.toolName} className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium leading-tight">{action.label || action.toolName}</div>
              {action.description && action.description !== "Thinking…" && (
                <div className="text-xs text-muted-foreground mt-0.5">{action.description}</div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadgeLocal status={localStatus} />
            {proposal && (
              <button
                onClick={() => setOpen((o) => !o)}
                className="text-muted-foreground hover:text-foreground"
              >
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Expandable proposal detail */}
        {open && proposal && (
          <ProposalDetail proposal={proposal} toolName={action.toolName} />
        )}

        {/* Confirm / reject buttons for proposed write actions */}
        {isProposed && proposal && (
          <div className="mt-3 flex items-center gap-2">
            {hasConfirmEndpoint ? (
              <Button
                size="sm"
                variant="success"
                className="h-7 text-xs"
                onClick={handleConfirm}
                disabled={confirming || rejecting}
              >
                {confirming ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Confirm
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs cursor-default"
                disabled
              >
                <Check className="h-3 w-3" />
                Proposed (display only)
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground"
              onClick={handleReject}
              disabled={confirming}
            >
              <XCircle className="h-3 w-3" />
              Dismiss
            </Button>
            <button
              onClick={() => setOpen((o) => !o)}
              className="ml-auto text-xs text-muted-foreground hover:underline"
            >
              {open ? "Hide details" : "View details"}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
