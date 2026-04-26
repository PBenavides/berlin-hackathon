import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@repo/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/components/table";
import { Badge } from "@repo/ui/components/badge";
import { api } from "@/lib/api";
import { formatEur } from "@/lib/utils";

export default async function OwnersListPage() {
  const owners = await api.owners.list();
  return (
    <div>
      <PageHeader title="Owners" subtitle={`${owners.length} ${owners.length === 1 ? "owner" : "owners"} in scope`} />
      <div className="p-8">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Buildings</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead className="text-right">Monthly</TableHead>
                  <TableHead>Language</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {owners.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell><Link href={`/owner/${o.id}`} className="font-medium hover:underline">{o.name}</Link></TableCell>
                    <TableCell><Badge variant="muted">{o.type.toUpperCase()}</Badge></TableCell>
                    <TableCell>{o.buildingsCount}</TableCell>
                    <TableCell>{o.unitsCount}</TableCell>
                    <TableCell className="text-right">{formatEur(o.monthlyRevenueEur)}</TableCell>
                    <TableCell className="font-mono text-xs">{o.language.toUpperCase()}</TableCell>
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
