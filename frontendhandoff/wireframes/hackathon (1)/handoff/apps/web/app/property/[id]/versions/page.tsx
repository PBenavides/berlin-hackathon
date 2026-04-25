import { Card, CardContent } from "@repo/ui/components/card";
import { Badge } from "@repo/ui/components/badge";

const VERSIONS = [
  { v: 11, date: "2026-04-22", author: "Memory agent", summary: "Added intercom replacement note (Unit 6B)" },
  { v: 10, date: "2026-04-15", author: "Operator", summary: "Updated Heinz GmbH SLA to 24h (was 48h)" },
  { v: 9,  date: "2026-03-12", author: "Operator", summary: "Approved €4,200 façade painting decision" },
  { v: 8,  date: "2026-02-14", author: "Memory agent", summary: "Auto-approval threshold raised to €200" },
];

export default function VersionsPage() {
  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y">
          {VERSIONS.map((v) => (
            <li key={v.v} className="flex items-start gap-4 p-4">
              <Badge variant="muted" className="font-mono">v{v.v}</Badge>
              <div className="flex-1">
                <div className="text-sm font-medium">{v.summary}</div>
                <div className="text-xs text-muted-foreground">{v.date} · {v.author}</div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
