import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { properties, owners, buildings } from "@/lib/data";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";

const TABS = [
  ["tickets",  "Tickets"],
  ["units",    "Units & Owners"],
  ["context",  "Context"],
  ["editor",   "Editor"],
  ["versions", "Versions"],
  ["sources",  "Sources"],
  ["policies", "Policies"],
  ["calls",    "Calls"],
] as const;

export default function PropertyLayout({
  params, children,
}: { params: { id: string }; children: React.ReactNode }) {
  const prop = properties.find((p) => p.id === params.id);
  if (!prop) notFound();
  const owner = owners.find((o) => o.id === prop.ownerId);
  const building = buildings.find((b) => b.id === prop.buildingId);

  return (
    <div>
      <PageHeader
        title={prop.name}
        subtitle={`${building?.address} · Owner: ${owner?.name} · context.md v${prop.contextVersion}`}
        crumbs={[{ label: "Properties" }, { label: prop.name }]}
      />
      <div className="border-b bg-background px-8">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(([slug, label]) => (
            <Link
              key={slug}
              href={`/property/${prop.id}/${slug}`}
              className="border-b-2 border-transparent px-3 py-2.5 text-sm text-muted-foreground hover:border-foreground/30 hover:text-foreground aria-[current=page]:border-foreground aria-[current=page]:text-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="p-8">{children}</div>
    </div>
  );
}
