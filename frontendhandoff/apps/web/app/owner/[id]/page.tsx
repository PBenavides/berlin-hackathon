import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@repo/ui/components/card";
import { Badge } from "@repo/ui/components/badge";
import { owners, properties, buildings } from "@/lib/data";
import { formatEur } from "@/lib/utils";

export default async function OwnerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = owners.find((x) => x.id === id);
  if (!o) notFound();
  const ownerBuildings = buildings.filter((b) => b.ownerId === o.id);
  const ownerProps = properties.filter((p) => p.ownerId === o.id);

  return (
    <div>
      <PageHeader title={o.name} subtitle={`${o.type.toUpperCase()} · ${o.contact}`} crumbs={[{ label: "Owners", href: "/owners" }, { label: o.name }]} />
      <div className="grid grid-cols-3 gap-6 p-8">
        <div className="col-span-2 space-y-4">
          <Card><CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Properties under this owner</h3>
            <ul className="divide-y">
              {ownerProps.map((p) => (
                <li key={p.id}>
                  <Link href={`/property/${p.id}/tickets`} className="flex items-center justify-between py-3 hover:bg-accent">
                    <div>
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.units} units · context.md v{p.contextVersion}</div>
                    </div>
                    {p.openTickets > 0 && <Badge variant="warning">{p.openTickets} open</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent></Card>

          <Card><CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Policies</h3>
            <ul className="list-disc space-y-1.5 pl-5 text-sm">
              {o.policies.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </CardContent></Card>

          <Card><CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Decisions</h3>
            <ul className="space-y-2 text-sm">
              {o.decisions.map((d, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-mono text-xs text-muted-foreground">{d.date}</span>
                  <span>{d.text}</span>
                </li>
              ))}
            </ul>
          </CardContent></Card>
        </div>

        <aside className="space-y-4">
          <Card><CardContent className="p-4 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stats</div>
            <ul className="mt-2 space-y-1.5">
              <li className="flex justify-between"><span className="text-muted-foreground">Buildings</span><span>{o.buildingsCount}</span></li>
              <li className="flex justify-between"><span className="text-muted-foreground">Units</span><span>{o.unitsCount}</span></li>
              <li className="flex justify-between"><span className="text-muted-foreground">Monthly</span><span>{formatEur(o.monthlyRevenueEur)}</span></li>
              <li className="flex justify-between"><span className="text-muted-foreground">Language</span><span>{o.language.toUpperCase()}</span></li>
            </ul>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact</div>
            <div className="mt-2 space-y-1 text-xs">
              <div>{o.contact}</div>
              <div className="text-muted-foreground">{o.email}</div>
              <div className="text-muted-foreground">{o.phone}</div>
            </div>
          </CardContent></Card>
        </aside>
      </div>
    </div>
  );
}
