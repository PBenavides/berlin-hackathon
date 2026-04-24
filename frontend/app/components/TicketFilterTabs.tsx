"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface TicketFilterTabsProps {
  counts: {
    all: number;
    open: number;
    proposed: number;
    resolved: number;
    rejected: number;
  };
  activeStatus: string;
}

const TABS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "proposed", label: "Proposed" },
  { key: "resolved", label: "Resolved" },
  { key: "rejected", label: "Rejected" },
];

export function TicketFilterTabs({ counts, activeStatus }: TicketFilterTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setStatus = useCallback(
    (status: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (status === "all") {
        params.delete("status");
      } else {
        params.set("status", status);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
      {TABS.map((tab) => {
        const count = counts[tab.key as keyof typeof counts] ?? 0;
        const isActive = activeStatus === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => setStatus(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
            <span
              className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                isActive
                  ? tab.key === "open"
                    ? "bg-amber-100 text-amber-700"
                    : tab.key === "proposed"
                    ? "bg-blue-100 text-blue-700"
                    : tab.key === "resolved"
                    ? "bg-green-100 text-green-700"
                    : tab.key === "rejected"
                    ? "bg-red-100 text-red-700"
                    : "bg-slate-100 text-slate-600"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
