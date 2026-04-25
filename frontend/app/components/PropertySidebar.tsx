"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

interface Property {
  id: string;
  name: string;
  slack_channel: string | null;
  address?: string | null;
}

interface PropertySidebarProps {
  properties: Property[];
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  );
}

function InboxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function PropertySidebar({ properties }: PropertySidebarProps) {
  const pathname = usePathname();

  // Determine active property from URL: /properties/[id]/...
  const activePropertyId = pathname.startsWith("/properties/")
    ? pathname.split("/")[2]
    : null;

  // Check if a specific sub-section is active
  const isContextActive = (id: string) =>
    pathname.startsWith(`/properties/${id}/context`);
  const isTicketsActive = (id: string) =>
    pathname.startsWith(`/properties/${id}/tickets`);
  const isConciergeActive = (id: string) =>
    pathname.startsWith(`/properties/${id}/concierge`);

  return (
    <aside className="w-60 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
      {/* Global nav */}
      <div className="px-3 py-4 border-b border-slate-100 space-y-1">
        <Link
          href="/tickets"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname === "/tickets"
              ? "bg-brand-50 text-brand-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <InboxIcon className="w-4 h-4 flex-shrink-0" />
          All Tickets
        </Link>
        <Link
          href="/audit"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname.startsWith("/audit")
              ? "bg-brand-50 text-brand-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Audit Log
        </Link>
      </div>

      {/* Properties section */}
      <div className="px-3 py-3 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-3 mb-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Properties
          </p>
          <span className="text-xs font-semibold text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5">
            {properties.length}
          </span>
        </div>
        <nav className="space-y-1">
          {properties.map((property) => {
            const isActive = activePropertyId === property.id;
            return (
              <div key={property.id}>
                {/* Property row */}
                <Link
                  href={`/properties/${property.id}/context`}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full ${
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <BuildingIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="block truncate leading-tight">
                      {property.name}
                    </span>
                    {property.slack_channel && (
                      <span
                        className={`block truncate text-xs font-normal leading-tight mt-0.5 ${
                          isActive ? "text-brand-500" : "text-slate-400"
                        }`}
                      >
                        {property.slack_channel}
                      </span>
                    )}
                  </div>
                  <ChevronRightIcon
                    className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${
                      isActive ? "rotate-90 text-brand-500" : "text-slate-300"
                    }`}
                  />
                </Link>

                {/* Sub-nav when property is active */}
                {isActive && (
                  <div className="ml-7 mt-1 space-y-0.5">
                    <Link
                      href={`/properties/${property.id}/context`}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        isContextActive(property.id)
                          ? "bg-brand-100 text-brand-700"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                      Context
                    </Link>
                    <Link
                      href={`/properties/${property.id}/tickets`}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        isTicketsActive(property.id)
                          ? "bg-brand-100 text-brand-700"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                      Tickets
                    </Link>
                    <Link
                      href={`/properties/${property.id}/concierge`}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        isConciergeActive(property.id)
                          ? "bg-brand-100 text-brand-700"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                      Concierge
                    </Link>
                    <Link
                      href={`/audit?property_id=${property.id}`}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                      Audit Trail
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Bottom links */}
      <div className="px-3 py-3 border-t border-slate-100">
        <Link
          href="/"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors`}
        >
          ← All Properties
        </Link>
      </div>
    </aside>
  );
}
