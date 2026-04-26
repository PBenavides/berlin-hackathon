import { Card, CardContent } from "@repo/ui/components/card";
import { Badge } from "@repo/ui/components/badge";
import { api } from "@/lib/api";
import type { Layer } from "@/lib/types";

const LAYER_ORDER: Array<{ key: Layer; title: string; tone: "zinc" | "purple" | "blue" | "emerald" }> = [
  { key: "vendor",   title: "Vendor layer",   tone: "zinc" },
  { key: "owner",    title: "Owner layer",    tone: "purple" },
  { key: "building", title: "Building layer", tone: "blue" },
  { key: "property", title: "Property layer", tone: "emerald" },
];

export default async function ContextPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await api.context.get(id);

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        Read-only rendered view of <code className="font-mono">context.md v{ctx.version}</code>
        {" · "}updated {new Date(ctx.updatedAt).toLocaleString("de-DE")}. Use the Editor tab to propose changes.
      </div>

      {LAYER_ORDER.map(({ key, title, tone }) => (
        <LayerCard key={key} title={title} tone={tone}>
          <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
            {ctx.layers[key]?.raw ?? <span className="text-muted-foreground italic">empty</span>}
          </pre>
        </LayerCard>
      ))}
    </div>
  );
}

function LayerCard({
  title, tone, children,
}: { title: string; tone: "zinc" | "purple" | "blue" | "emerald"; children: React.ReactNode }) {
  const cls = {
    zinc: "border-zinc-500/30",
    purple: "border-purple-500/30",
    blue: "border-blue-500/30",
    emerald: "border-emerald-500/30",
  }[tone];
  return (
    <Card className={cls}>
      <CardContent className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="muted">{title}</Badge>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
