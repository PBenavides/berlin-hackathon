import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@repo/ui/components/card";
import { Badge } from "@repo/ui/components/badge";
import { RiskBadge, StatusBadge } from "@/components/badges";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { AlertTriangle, Phone, Mail, Bot } from "lucide-react";

export default async function EscalationsPage() {
  const tickets = await api.escalations.list();
  return (
    <div>
      <PageHeader
        title="Escalations"
        subtitle={`${tickets.length} open ${tickets.length === 1 ? "escalation" : "escalations"} (high-risk or SLA breach)`}
      />
      <div className="p-8">
        <Card>
          <CardContent className="p-0">
            {tickets.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                <AlertTriangle className="mx-auto mb-2 h-5 w-5" />
                No escalations.
              </div>
            ) : (
              <ul className="divide-y">
                {tickets.map((t) => (
                  <li key={t.id}>
                    <Link href={`/ticket/${t.id}`} className="flex items-start gap-3 p-4 hover:bg-accent">
                      {t.source === "voice" ? <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" /> : <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{t.subject}</span>
                          <StatusBadge status={t.status} />
                          <RiskBadge risk={t.risk} />
                          {(t as any).escalatedAt && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              Agent escalated
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          {t.raisedBy} · {timeAgo(t.createdAt)} ago
                        </p>
                        {(t as any).escalationReason && (
                          <p className="mt-1 line-clamp-2 text-xs text-destructive/80">
                            {(t as any).escalationReason.split("\n")[0]}
                          </p>
                        )}
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
    </div>
  );
}
