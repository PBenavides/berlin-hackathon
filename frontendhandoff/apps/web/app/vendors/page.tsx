import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@repo/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/components/table";
import { Badge } from "@repo/ui/components/badge";
import { api } from "@/lib/api";

export default async function VendorsListPage() {
  const vendors = await api.vendors.list();
  return (
    <div>
      <PageHeader title="Vendors" subtitle={`${vendors.length} ${vendors.length === 1 ? "vendor" : "vendors"} in network`} />
      <div className="p-8">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Trade</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Preferred</TableHead>
                  <TableHead>Phone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell><Link href={`/vendor/${v.id}`} className="font-medium hover:underline">{v.name}</Link></TableCell>
                    <TableCell>{v.trade}</TableCell>
                    <TableCell>{v.rating} / 5</TableCell>
                    <TableCell className="font-mono text-xs">{v.slaHours}h</TableCell>
                    <TableCell>{v.preferred && <Badge variant="success">preferred</Badge>}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{v.phone}</TableCell>
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
