import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb { label: string; href?: string }

export function PageHeader({
  title, subtitle, crumbs, actions,
}: { title: string; subtitle?: string; crumbs?: Crumb[]; actions?: React.ReactNode }) {
  return (
    <div className="border-b bg-background">
      <div className="px-8 py-5">
        {crumbs && crumbs.length > 0 && (
          <nav className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                {c.href ? (
                  <Link href={c.href} className="hover:text-foreground">{c.label}</Link>
                ) : (
                  <span>{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
