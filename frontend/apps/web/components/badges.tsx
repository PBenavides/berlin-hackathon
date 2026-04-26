import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";
import type { Risk, TicketStatus, Layer } from "@/lib/types";

export function RiskBadge({ risk }: { risk: Risk }) {
  const map = { low: "muted", medium: "warning", high: "destructive" } as const;
  return <Badge variant={map[risk]}>{risk}</Badge>;
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  const map: Record<TicketStatus, { v: any; label: string }> = {
    new:             { v: "info",    label: "new" },
    triaged:         { v: "info",    label: "triaged" },
    proposed:        { v: "warning", label: "proposed" },
    approved:        { v: "success", label: "approved" },
    awaiting_vendor: { v: "info",    label: "vendor pending" },
    scheduled:       { v: "info",    label: "scheduled" },
    in_progress:     { v: "info",    label: "in progress" },
    completed:       { v: "success", label: "completed" },
    resolved:        { v: "muted",   label: "resolved" },
    rejected:        { v: "destructive", label: "rejected" },
  };
  const m = map[status];
  return <Badge variant={m.v}>{m.label}</Badge>;
}

const LAYER_DOT: Record<Layer, string> = {
  vendor:   "bg-zinc-500",
  owner:    "bg-purple-600",
  building: "bg-blue-600",
  property: "bg-emerald-700",
};

export function LayerDot({ layer, className }: { layer: Layer; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full", LAYER_DOT[layer], className)} />;
}

export function LayerBadge({ layer }: { layer: Layer }) {
  const labels = { vendor: "Vendor", owner: "Owner", building: "Building", property: "Property" };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium">
      <LayerDot layer={layer} />
      {labels[layer]}
    </span>
  );
}
