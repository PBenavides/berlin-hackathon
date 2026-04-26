"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@repo/ui/lib/utils";
import {
  ChevronDown, ChevronRight, LayoutDashboard, AlertTriangle, Building2,
  Users, Wrench, FileText, MessageSquareText, Sparkles, Home,
  PanelLeftClose, PanelLeftOpen, Sun, Moon, RotateCcw, Loader2, Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { subscribe } from "@/lib/bus";
import { useToastSafe } from "@/components/toaster";
import { useAutoSolve } from "@/lib/auto-solve-context";
import type { Property } from "@/lib/types";

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
  const [properties, setProperties] = useState<Property[]>([]);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Demo reset state
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const toast = useToastSafe();

  // Auto-Solve toggle (Sprint 3)
  const { autoSolve, queueStatus, isToggling, enable, disable } = useAutoSolve();
  const [showAutoSolveConfirm, setShowAutoSolveConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      api.properties.list()
        .then((list) => { if (!cancelled) setProperties(list); })
        .catch(() => { /* silently leave list empty */ });
    refresh();
    const unsub = subscribe((event) => {
      if (event.kind === "context-bumped" || event.kind === "ticket-changed") refresh();
    });
    return () => { cancelled = true; unsub(); };
  }, []);

  const activePropId = pathname.match(/^\/property\/([^/]+)/)?.[1] ?? null;
  const activeProp = activePropId ? properties.find((p) => p.id === activePropId) ?? null : null;

  async function handleAutoSolveToggle() {
    if (autoSolve) {
      try {
        await disable();
        toast.push({
          title: "Auto-Solve stopped",
          description: "The agent will finish the current ticket and then stop.",
          variant: "default",
        });
      } catch (err) {
        toast.push({
          title: "Failed to stop",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    } else {
      setShowAutoSolveConfirm(true);
    }
  }

  async function handleAutoSolveConfirm() {
    setShowAutoSolveConfirm(false);
    try {
      await enable();
      toast.push({
        title: "Auto-Solve activated",
        description: "Hermes is now processing tickets autonomously.",
        variant: "success",
      });
    } catch (err) {
      toast.push({
        title: "Failed to start",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function handleReset() {
    setShowResetConfirm(false);
    setResetting(true);
    // s4-f4: Stop agent before resetting if it's running
    if (autoSolve) {
      try { await disable(); } catch { /* ignore — reset will clear state anyway */ }
    }
    try {
      await api.dev.reset();
      toast.push({
        title: "Demo zurückgesetzt",
        description: "Alle Tickets und Daten wurden auf den Demo-Ausgangszustand zurückgesetzt.",
        variant: "success",
      });
      // Hard-redirect to overview so all client state (sidebar counts,
      // cached queries) is fully wiped — avoids the router.refresh() race
      // condition where refresh fires against the current route, not /overview.
      window.location.href = "/overview";
    } catch (err) {
      toast.push({
        title: "Reset fehlgeschlagen",
        description: err instanceof Error ? err.message : "Unbekannter Fehler beim Zurücksetzen.",
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
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

        {/* Demo Mode Banner (visible when expanded) */}
        {!collapsed && (
          <div className="flex items-center gap-1.5 border-b bg-amber-500/10 px-3 py-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Demo Mode
            </span>
          </div>
        )}

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

        {/* Collapsed demo mode dot */}
        {collapsed && (
          <div
            className="mx-auto mt-1 h-1.5 w-1.5 rounded-full bg-amber-500"
            title="Demo Mode"
          />
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
            suppressHydrationWarning
          >
            <span suppressHydrationWarning className="inline-flex h-3.5 w-3.5 items-center justify-center">
              {mounted ? (theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />) : null}
            </span>
            {!collapsed && <span className="text-[11px]">Toggle theme</span>}
          </button>

          {/* Auto-Solve Toggle (Sprint 3) */}
          <button
            onClick={handleAutoSolveToggle}
            disabled={isToggling}
            className={cn(
              "flex items-center gap-2 rounded-md p-1.5 transition-colors",
              autoSolve
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
              isToggling && "opacity-60 cursor-not-allowed",
              collapsed && "justify-center"
            )}
            title={autoSolve ? "Auto-Solve ON — click to stop" : "Enable Agent Auto-Solve"}
          >
            {isToggling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className={cn("h-3.5 w-3.5 shrink-0", autoSolve && "animate-pulse")} />
            )}
            {!collapsed && (
              <span className="text-[11px] font-medium">
                {autoSolve
                  ? `Auto-Solve ON${queueStatus.remainingCount > 0 ? ` (${queueStatus.remainingCount} left)` : ""}`
                  : "Agent Auto-Solve"}
              </span>
            )}
          </button>

          {/* Reset Demo button */}
          <button
            onClick={() => setShowResetConfirm(true)}
            disabled={resetting}
            className={cn(
              "flex items-center gap-2 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors",
              resetting && "opacity-60 cursor-not-allowed",
              collapsed && "justify-center"
            )}
            title="Reset Demo"
          >
            {resetting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            {!collapsed && (
              <span className="text-[11px]">
                {resetting ? "Resetting…" : "Reset Demo"}
              </span>
            )}
          </button>

          {!collapsed && (
            <div className="mt-2 text-[11px] text-muted-foreground">
              {activeProp ? (
                <div className="flex items-center justify-between" title={activeProp.name}>
                  <span className="truncate">{activeProp.name} · context.md</span>
                  <span className="font-mono tabular-nums text-foreground/80">v{activeProp.contextVersion}</span>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span>context.md</span>
                  <span className="font-mono text-muted-foreground/60">—</span>
                </div>
              )}
              <div className="mt-1 flex items-center justify-between">
                <span>Hermes</span>
                <span className="font-mono text-emerald-500">online</span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Auto-Solve Confirmation Dialog */}
      {showAutoSolveConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auto-solve-dialog-title"
          onClick={() => setShowAutoSolveConfirm(false)}
          onKeyDown={(e) => { if (e.key === "Escape") setShowAutoSolveConfirm(false); }}
          tabIndex={-1}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-xl border bg-background p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center gap-2">
              <Zap className="h-5 w-5 text-emerald-500" />
              <h2 id="auto-solve-dialog-title" className="text-base font-semibold">Activate Agent Auto-Solve?</h2>
            </div>
            <p className="mb-2 text-sm text-muted-foreground">
              Hermes will autonomously process <strong>all open tickets</strong> one by one, in priority order.
            </p>
            <ul className="mb-5 space-y-1 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                Write actions (emails, responses, reports) auto-confirm after a brief delay
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                Human escalations are <strong>not</strong> auto-confirmed — they stay pending
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                You can stop the agent at any time — the current ticket will finish
              </li>
            </ul>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAutoSolveConfirm(false)}
                className="rounded-md px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleAutoSolveConfirm}
                className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
              >
                <Zap className="h-3.5 w-3.5" />
                Activate Auto-Solve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-dialog-title"
          onClick={() => setShowResetConfirm(false)}
          onKeyDown={(e) => { if (e.key === "Escape") setShowResetConfirm(false); }}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
          tabIndex={-1}
        >
          {/* stopPropagation prevents backdrop click from reaching the inner card */}
          <div
            className="mx-4 w-full max-w-sm rounded-xl border bg-background p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-destructive" />
              <h2 id="reset-dialog-title" className="text-base font-semibold">Demo zurücksetzen?</h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Alle Tickets, Vorschläge, Kontextänderungen und Protokolle werden gelöscht und
              durch den Demo-Ausgangszustand ersetzt. <strong>Diese Aktion kann nicht rückgängig gemacht werden.</strong>
            </p>
            {autoSolve && (
              <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                ⚠ Der Agent wird vor dem Zurücksetzen gestoppt.
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="rounded-md px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Abbrechen
              </button>
              <button
                onClick={handleReset}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Ja, zurücksetzen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
