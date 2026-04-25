import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@repo/ui/components/card";
import { Badge } from "@repo/ui/components/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/components/table";
import { vendors, vendorCases, properties } from "@/lib/data";
import { formatEur } from "@/lib/utils";

export default function VendorDetail({ params }: { params: { id: string } }) {
  const v = vendors.find((x) => x.id === params.id);
  if (!v) notFound();
  const cases = vendorCases.filter((c) => c.vendorId === v.id);

  return (
    <div>
      <PageHeader title={v.name} subtitle={`${v.trade} · ${v.preferred ? "Preferred" : "Standard"} · SLA ${v.slaHours}h`} crumbs={[{ label: "Vendors", href: "/vendors" }, { label: v.name }]} />
      <div className="grid grid-cols-3 gap-6 p-8">
        <div className="col-span-2 space-y-4">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Property</TableHead><TableHead>Description</TableHead><TableHead>Cost</TableHead><TableHead>SLA</TableHead><TableHead>Rating</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {cases.map((c) => {
                  const p = properties.find((x) => x.id === c.propertyId);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.date}</TableCell>
                      <TableCell><Link href={`/property/${p?.id}/tickets`} className="hover:underline">{p?.name}</Link></TableCell>
                      <TableCell className="text-sm">{c.description}</TableCell>
                      <TableCell>{formatEur(c.costEur)}</TableCell>
                      <TableCell>{c.slaMet ? <Badge variant="success">met</Badge> : <Badge variant="destructive">missed</Badge>}</TableCell>
                      <TableCell>{c.rating}/5</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </div>
        <aside>
          <Card><CardContent className="p-4 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact</div>
            <div className="mt-2 space-y-1 text-xs">
              <div>{v.contact}</div>
              <div className="text-muted-foreground">{v.email}</div>
              <div className="text-muted-foreground">{v.phone}</div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded border p-2 text-center"><div className="text-lg font-semibold">{v.rating}</div><div className="text-muted-foreground">rating</div></div>
              <div className="rounded border p-2 text-center"><div className="text-lg font-semibold">{v.slaHours}h</div><div className="text-muted-foreground">SLA</div></div>
            </div>
          </CardContent></Card>
        </aside>
      </div>
    </div>
  );
}
