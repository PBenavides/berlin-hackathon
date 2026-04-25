import { Card, CardContent } from "@repo/ui/components/card";
import { Badge } from "@repo/ui/components/badge";
import { owners, properties } from "@/lib/data";

export default async function PoliciesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prop = properties.find((p) => p.id === id)!;
  const owner = owners.find((o) => o.id === prop.ownerId)!;

  const policies = [
    { code: "P1", name: "approval_threshold",  rule: "Auto-approve dispatches ≤ €200", source: "Owner" },
    { code: "P2", name: "board_signoff",       rule: "Repairs > €1,000 require Beirat sign-off", source: "Owner" },
    { code: "P3", name: "communication_tone",  rule: "All tenant correspondence in Sie-Form", source: "Owner" },
    { code: "P4", name: "vendor_preference",   rule: "Prefer Heinz GmbH for HVAC", source: "Building" },
    { code: "P5", name: "callback_required",   rule: "Mobility-flagged tenants get written confirmation", source: "Property" },
  ];

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y">
          {policies.map((p) => (
            <li key={p.code} className="flex items-start gap-4 p-4">
              <Badge variant="muted" className="font-mono">{p.code}</Badge>
              <div className="flex-1">
                <div className="text-sm font-medium">{p.name}</div>
                <div className="mt-0.5 text-sm text-muted-foreground">{p.rule}</div>
              </div>
              <Badge variant="outline">{p.source}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
