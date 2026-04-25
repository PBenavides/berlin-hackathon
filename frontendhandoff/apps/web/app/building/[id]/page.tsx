import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@repo/ui/components/card";
import { buildings, owners, vendors } from "@/lib/data";

export default async function BuildingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = buildings.find((x) => x.id === id);
  if (!b) notFound();
  const owner = owners.find((o) => o.id === b.ownerId);
  const buildingVendors = vendors.filter((v) => b.vendors.includes(v.id));

  return (
    <div>
      <PageHeader title={b.name} subtitle={`${b.address} · built ${b.yearBuilt} · owned by ${owner?.name}`} crumbs={[{ label: "Buildings", href: "/buildings" }, { label: b.name }]} />
      <div className="grid grid-cols-3 gap-6 p-8">
        <div className="col-span-2 space-y-4">
          <Card><CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Systems</h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {Object.entries(b.systems).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
                  <dd className="mt-0.5">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent></Card>
          {b.notes && <Card><CardContent className="p-5"><h3 className="mb-2 text-sm font-semibold">Notes</h3><p className="text-sm">{b.notes}</p></CardContent></Card>}
        </div>
        <aside>
          <Card><CardContent className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vendors</div>
            <ul className="mt-2 space-y-1 text-sm">
              {buildingVendors.map((v) => (
                <li key={v.id}><Link href={`/vendor/${v.id}`} className="hover:underline">{v.name}</Link> <span className="text-xs text-muted-foreground">· {v.trade}</span></li>
              ))}
            </ul>
          </CardContent></Card>
        </aside>
      </div>
    </div>
  );
}
