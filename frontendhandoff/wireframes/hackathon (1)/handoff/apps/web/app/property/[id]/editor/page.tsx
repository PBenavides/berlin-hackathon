import { Card, CardContent } from "@repo/ui/components/card";
import { Textarea } from "@repo/ui/components/input";
import { Button } from "@repo/ui/components/button";

export default function EditorPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Edits create a proposal — they don't commit until approved.</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">Diff</Button>
          <Button size="sm">Propose change</Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <Textarea
            className="min-h-[480px] rounded-none border-0 font-mono text-xs"
            defaultValue={`# property/${params.id}/context.md (v11)\n\n## Vendors\n- Heinz GmbH (HVAC, preferred, SLA 24h)\n- Bekey Service (locks/intercom, SLA 4h)\n- Wasser Schmidt (plumbing, SLA 8h)\n\n## Owner policies\n- Repairs > €1,000 require board sign-off (Verwaltungsbeirat)\n- All correspondence in Sie-Form\n\n## Building\n- Pre-war Altbau (1928), Denkmalschutz\n- Vaillant gas central, replaced 2019\n- 8 units (7 residential + 1 commercial)\n\n## Tenant flags\n- Unit 3B (Schmidt): mobility limitation — written confirmation mandatory\n`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
