"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@repo/ui/lib/utils";
import {
  ChevronDown, ChevronRight, LayoutDashboard, AlertTriangle, Building2,
  Users, Wrench, FileText, MessageSquareText, Sparkles, Home,
  PanelLeftClose, PanelLeftOpen, Sun, Moon,
} from "lucide-react";
import { properties } from "@/lib/data";

const PROP_TABS = [
  ["tickets",  "Tickets"],
  ["units",    "Units & Owners"],
  ["context",  "Context"],
  ["editor",   "Editor"],
  ["versions", "Versions"],
  ["sources",  "Sources"],
  ["policies", "Policies"],
  ["calls",    "Calls"],
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openProps, setOpenProps] = useState<Record<string, boolean>>({ p1: true });
  const { theme, setTheme } = useTheme();

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r bg-background transition-all duration-200",
        collapsed ? "w-14" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-3">
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-foreground text-background">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-sm font-semibold">Buena</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Context Engine</span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto grid h-7 w-7 place-items-center rounded-md bg-foreground text-background">
            <Sparkles className="h-4 w-4" />
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="ml-2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="mx-auto mt-3 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Expand sidebar"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      {/* Nav */}
      <nav className={cn("flex-1 overflow-y-auto p-2 text-sm", collapsed && "overflow-hidden")}>
        {!collapsed ? (
          <>
            <Zone label="Work">
              <Item href="/overview"    icon={LayoutDashboard} active={pathname === "/overview"}>Overview</Item>
              <Item href="/escalations" icon={AlertTriangle}   active={pathname === "/escalations"}>Escalations</Item>
            </Zone>

            <Zone label="Properties">
              {properties.map((p) => {
                const open = openProps[p.id];
                const inThisProp = pathname.startsWith(`/property/${p.id}`);
                return (
                  <div key={p.id}>
                    <button
                      onClick={() => setOpenProps((s) => ({ ...s, [p.id]: !s[p.id] }))}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-accent",
                        inThisProp && "bg-accent"
                      )}
                    >
                      <span className="flex items-center gap-2 truncate text-sm">
                        <Home className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{p.name}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {p.openTickets > 0 && (
                          <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                            {p.openTickets}
                          </span>
                        )}
                        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </span>
                    </button>
                    {open && (
                      <div className="ml-5 mt-0.5 border-l pl-2">
                        {PROP_TABS.map(([slug, label]) => {
                          const href = `/property/${p.id}/${slug}`;
                          return (
                            <Link
                              key={slug}
                              href={href}
                              className={cn(
                                "block rounded-md px-2 py-1 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground",
                                pathname === href && "bg-accent text-foreground font-medium"
                              )}
                            >
                              {label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </Zone>

            <Zone label="Knowledge">
              <Item href="/vendors"   icon={Wrench}    active={pathname.startsWith("/vendors") || pathname.startsWith("/vendor/")}>Vendors</Item>
              <Item href="/owners"    icon={Users}     active={pathname.startsWith("/owners") || pathname.startsWith("/owner/")}>Owners</Item>
              <Item href="/buildings" icon={Building2} active={pathname.startsWith("/buildings") || pathname.startsWith("/building/")}>Buildings</Item>
            </Zone>

            <Zone label="Tools">
              <Item href="/extract" icon={FileText}          active={pathname === "/extract"}>PDF Extract</Item>
              <Item href="/chat"    icon={MessageSquareText} active={pathname === "/chat"}>Hermes Chat</Item>
            </Zone>
          </>
        ) : (
          /* Icon-only mode */
          <div className="mt-1 flex flex-col items-center gap-1">
            {[
              { href: "/overview",    icon: LayoutDashboard,  label: "Overview" },
              { href: "/escalations", icon: AlertTriangle,    label: "Escalations" },
              { href: "/vendors",     icon: Wrench,           label: "Vendors" },
              { href: "/owners",      icon: Users,            label: "Owners" },
              { href: "/buildings",   icon: Building2,        label: "Buildings" },
              { href: "/extract",     icon: FileText,         label: "PDF Extract" },
              { href: "/chat",        icon: MessageSquareText, label: "Hermes Chat" },
            ].map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                title={label}
                className={cn(
                  "rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground",
                  pathname.startsWith(href) && href !== "/" && "bg-accent text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className={cn("border-t p-3", collapsed && "flex flex-col items-center gap-2 px-0")}>
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex items-center gap-2 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {!collapsed && <span className="text-[11px]">Toggle theme</span>}
        </button>

        {!collapsed && (
          <div className="mt-2 text-[11px] text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>context.md</span>
              <span className="font-mono">v11</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Hermes</span>
              <span className="font-mono text-emerald-500">online</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function Zone({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function Item({
  href, icon: Icon, active, children,
}: { href: string; icon: React.ComponentType<{ className?: string }>; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
        active && "bg-accent font-medium"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span>{children}</span>
    </Link>
  );
}
