import { Card, CardContent } from "@repo/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/components/table";
import { Badge } from "@repo/ui/components/badge";
import { units, properties, owners } from "@/lib/data";
import { formatEur } from "@/lib/utils";

export default function UnitsPage({ params }: { params: { id: string } }) {
  const propUnits = units.filter((u) => u.propertyId === params.id);
  const prop = properties.find((p) => p.id === params.id)!;
  const owner = owners.find((o) => o.id === prop.ownerId);

  const totalArea = propUnits.reduce((s, u) => s + u.areaQm, 0);
  const totalRent = propUnits.reduce((s, u) => s + (u.rentEur ?? 0), 0);
  const rented = propUnits.filter((u) => u.rentEur != null).length;
  const uniqueOwners = new Set(propUnits.map((u) => u.ownerName)).size;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">Units</div><div className="mt-1 text-2xl font-semibold">{propUnits.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">Unique owners</div><div className="mt-1 text-2xl font-semibold">{uniqueOwners}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">Rented out</div><div className="mt-1 text-2xl font-semibold">{rented} <span className="text-sm font-normal text-muted-foreground">/ {propUnits.length}</span></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">Monthly rent</div><div className="mt-1 text-2xl font-semibold">{formatEur(totalRent)}</div></CardContent></Card>
      </div>

      <Card className="border-purple-200 bg-purple-50/40">
        <CardContent className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-purple-900">WEG context</div>
          <p className="mt-1 text-sm">
            Owner layer: <strong>{owner?.name}</strong> ({owner?.type.toUpperCase()}). Beirat policies cascade to all units below.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>MEA‰</TableHead>
                <TableHead>Owner (Eigentümer)</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead className="text-right">Rent</TableHead>
                <TableHead>Beirat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {propUnits.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono font-medium">{u.label}</TableCell>
                  <TableCell><Badge variant={u.type === "commercial" ? "info" : "muted"}>{u.type}</Badge></TableCell>
                  <TableCell>{u.areaQm} m²</TableCell>
                  <TableCell className="font-mono text-xs">{u.meaPermille}</TableCell>
                  <TableCell>{u.ownerName} <span className="text-xs text-muted-foreground">since {u.ownerSince}</span></TableCell>
                  <TableCell>{u.tenant}</TableCell>
                  <TableCell className="text-right">{u.rentEur ? formatEur(u.rentEur) : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{u.beirat && <Badge variant="warning">Beirat</Badge>}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/40 font-medium">
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell>{totalArea} m²</TableCell>
                <TableCell className="font-mono text-xs">{propUnits.reduce((s, u) => s + u.meaPermille, 0)}</TableCell>
                <TableCell colSpan={2}></TableCell>
                <TableCell className="text-right">{formatEur(totalRent)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
