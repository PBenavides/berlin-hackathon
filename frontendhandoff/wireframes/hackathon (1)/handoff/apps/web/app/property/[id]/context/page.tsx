import { Card, CardContent } from "@repo/ui/components/card";
import { Badge } from "@repo/ui/components/badge";
import { properties, owners, buildings } from "@/lib/data";

export default function ContextPage({ params }: { params: { id: string } }) {
  const prop = properties.find((p) => p.id === params.id)!;
  const owner = owners.find((o) => o.id === prop.ownerId)!;
  const building = buildings.find((b) => b.id === prop.buildingId)!;

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        Read-only rendered view of <code className="font-mono">context.md v{prop.contextVersion}</code>. Use the Editor tab to propose changes.
      </div>

      <Layer title="Vendor layer" tone="zinc">
        <ul className="space-y-2 text-sm">
          {building.vendors.map((vid) => <li key={vid} className="font-mono">{vid}</li>)}
        </ul>
      </Layer>

      <Layer title="Owner layer" tone="purple">
        <div className="text-sm"><strong>{owner.name}</strong> ({owner.type})</div>
        <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
          {owner.policies.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      </Layer>

      <Layer title="Building layer" tone="blue">
        <div className="text-sm">{building.address} · built {building.yearBuilt} · {building.units} units</div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          {Object.entries(building.systems).map(([k, v]) => (
            <div key={k}><span className="text-muted-foreground">{k}: </span>{v}</div>
          ))}
        </div>
        {building.notes && <p className="mt-2 text-xs text-muted-foreground">{building.notes}</p>}
      </Layer>

      <Layer title="Property layer" tone="emerald">
        <div className="text-sm">{prop.openTickets} open tickets · phone {prop.phone} · email {prop.email}</div>
      </Layer>
    </div>
  );
}

function Layer({ title, tone, children }: { title: string; tone: "zinc"|"purple"|"blue"|"emerald"; children: React.ReactNode }) {
  const cls = { zinc: "border-zinc-200", purple: "border-purple-200", blue: "border-blue-200", emerald: "border-emerald-200" }[tone];
  return (
    <Card className={cls}>
      <CardContent className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="muted">{title}</Badge>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
