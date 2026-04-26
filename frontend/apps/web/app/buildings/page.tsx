import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@repo/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/components/table";
import { api } from "@/lib/api";

export default async function BuildingsListPage() {
  const buildings = await api.buildings.list();
  return (
    <div>
      <PageHeader title="Buildings" subtitle={`${buildings.length} ${buildings.length === 1 ? "building" : "buildings"} in scope`} />
      <div className="p-8">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Built</TableHead>
                  <TableHead>Units</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buildings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell><Link href={`/building/${b.id}`} className="font-medium hover:underline">{b.name}</Link></TableCell>
                    <TableCell className="text-sm">{b.address}</TableCell>
                    <TableCell>{b.city}</TableCell>
                    <TableCell className="font-mono text-xs">{b.yearBuilt}</TableCell>
                    <TableCell>{b.units}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
