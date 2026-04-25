import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@repo/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/components/table";
import { Badge } from "@repo/ui/components/badge";
import { owners } from "@/lib/data";
import { formatEur } from "@/lib/utils";

export default function OwnersPage() {
  return (
    <div>
      <PageHeader title="Owners" subtitle="WEGs, companies, and private owners — top of the cascade" />
      <div className="p-8">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Buildings</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead className="text-right">Monthly</TableHead>
                  <TableHead>Contact</TableHead>
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
                    <TableCell className="text-xs text-muted-foreground">{o.contact}</TableCell>
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
