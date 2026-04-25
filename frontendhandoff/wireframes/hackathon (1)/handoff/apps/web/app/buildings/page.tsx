import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@repo/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/components/table";
import { buildings, owners } from "@/lib/data";

export default function BuildingsPage() {
  return (
    <div>
      <PageHeader title="Buildings" subtitle="Physical envelopes — systems, vendors, structural facts" />
      <div className="p-8">
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Building</TableHead><TableHead>Owner</TableHead><TableHead>Year</TableHead><TableHead>Units</TableHead><TableHead>Heating</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {buildings.map((b) => {
                const owner = owners.find((o) => o.id === b.ownerId);
                return (
                  <TableRow key={b.id}>
                    <TableCell><Link href={`/building/${b.id}`} className="font-medium hover:underline">{b.name}</Link><div className="text-xs text-muted-foreground">{b.address}</div></TableCell>
                    <TableCell>{owner?.name}</TableCell>
                    <TableCell>{b.yearBuilt}</TableCell>
                    <TableCell>{b.units}</TableCell>
                    <TableCell className="text-xs">{b.systems.heating}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>
    </div>
  );
}
