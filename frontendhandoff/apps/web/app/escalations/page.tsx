import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@repo/ui/components/card";
import { Badge } from "@repo/ui/components/badge";
import { tickets, properties } from "@/lib/data";
import { timeAgo } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

export default function EscalationsPage() {
  const escalated = tickets.filter((t) => t.risk === "high" && t.status !== "resolved");

  return (
    <div>
      <PageHeader
        title="Escalations"
        subtitle="High-risk tickets the agent will not auto-act on"
      />
      <div className="p-8">
        <Card>
          <CardContent className="p-0">
            {escalated.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No active escalations.</div>
            ) : (
              <ul className="divide-y">
                {escalated.map((t) => {
                  const prop = properties.find((p) => p.id === t.propertyId);
                  return (
                    <li key={t.id}>
                      <Link href={`/ticket/${t.id}`} className="block p-4 hover:bg-accent">
                        <div className="flex items-start justify-between">
                          <div className="flex gap-3">
                            <AlertTriangle className="mt-0.5 h-4 w-4 text-red-600" />
                            <div>
                              <div className="flex items-center gap-2 text-sm font-semibold">
                                {t.subject}
                                <Badge variant="destructive">high risk</Badge>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {prop?.name} · raised by {t.raisedBy} · {timeAgo(t.createdAt)} ago
                              </p>
                              <p className="mt-2 text-sm">{t.excerpt}</p>
                            </div>
                          </div>
                          <span className="font-mono text-xs text-muted-foreground">{t.num}</span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
