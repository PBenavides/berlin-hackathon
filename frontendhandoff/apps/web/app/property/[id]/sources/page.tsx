import { Card, CardContent } from "@repo/ui/components/card";
import { Badge } from "@repo/ui/components/badge";
import { FileText, Phone, Mail } from "lucide-react";

const SOURCES = [
  { type: "pdf",   icon: FileText, name: "WEG-Protokoll 2026-03.pdf",  date: "2026-03-15", extracted: 12 },
  { type: "voice", icon: Phone,    name: "Schmidt call 2026-04-25",    date: "2026-04-25", extracted: 4 },
  { type: "email", icon: Mail,     name: "Wagner — drain slow",         date: "2026-04-25", extracted: 2 },
];

export default function SourcesPage() {
  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y">
          {SOURCES.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={i} className="flex items-center gap-4 p-4">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.date} · {s.extracted} facts extracted</div>
                </div>
                <Badge variant="muted">{s.type}</Badge>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
