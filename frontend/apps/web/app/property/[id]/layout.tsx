import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { api, ApiError } from "@/lib/api";

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

export default async function PropertyLayout({
  params, children,
}: { params: Promise<{ id: string }>; children: React.ReactNode }) {
  const { id } = await params;

  let prop, owner, building;
  try {
    prop = await api.properties.get(id);
    [owner, building] = await Promise.all([
      api.owners.get(prop.ownerId),
      api.buildings.get(prop.buildingId),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div>
      <PageHeader
        title={prop.name}
        subtitle={`${building.address} · Owner: ${owner.name} · context.md v${prop.contextVersion}`}
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
