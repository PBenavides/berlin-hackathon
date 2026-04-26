import { Card, CardContent } from "@repo/ui/components/card";
import { api } from "@/lib/api";

export default async function VersionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const versions = await api.context.versions(id);

  return (
    <Card>
      <CardContent className="p-0">
        {versions.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No versions yet.</div>
        ) : (
          <ul className="divide-y">
            {versions.map((v) => (
              <li key={v.version} className="flex items-start gap-4 p-4">
                <span className="font-mono text-sm">v{v.version}</span>
                <div className="flex-1">
                  <div className="text-sm">{v.summary}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(v.createdAt).toLocaleString("de-DE")} · {v.author}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
