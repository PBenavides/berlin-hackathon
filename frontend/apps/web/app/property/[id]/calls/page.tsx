import Link from "next/link";
import { Card, CardContent } from "@repo/ui/components/card";
import { Badge } from "@repo/ui/components/badge";
import { Phone } from "lucide-react";
import { api } from "@/lib/api";

export default async function CallsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const propTickets = await api.tickets.list({ propertyId: id });
  const calls = propTickets.filter((t) => t.callSession);

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y">
          {calls.map((t) => (
            <li key={t.id}>
              <Link href={`/ticket/${t.id}`} className="flex items-start gap-3 p-4 hover:bg-accent">
                <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{t.subject}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.raisedBy} · {t.callSession?.duration} · {t.callSession?.callerPhone}
                  </div>
                </div>
                <Badge variant="muted">{t.callSession?.duration}</Badge>
              </Link>
            </li>
          ))}
          {calls.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">No calls.</li>}
        </ul>
      </CardContent>
    </Card>
  );
}
