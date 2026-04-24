import type { Metadata } from "next";
import "./globals.css";
import { PropertySidebar } from "./components/PropertySidebar";

export const metadata: Metadata = {
  title: "Buena ContextOps",
  description: "Human-reviewed property memory for AI operations",
};

interface Property {
  id: string;
  name: string;
  slack_channel: string | null;
}

async function getProperties(): Promise<Property[]> {
  try {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    const res = await fetch(`${backendUrl}/api/v1/properties`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const properties = await getProperties();

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          {/* Top nav bar */}
          <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
            <div className="px-4 sm:px-6">
              <div className="flex items-center justify-between h-14">
                <div className="flex items-center gap-3">
                  <a href="/" className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-xs">B</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">Buena</span>
                      <span className="text-brand-600 font-semibold"> ContextOps</span>
                    </div>
                  </a>
                </div>
                <nav className="flex items-center gap-5">
                  <a
                    href="/"
                    className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    Properties
                  </a>
                  <a
                    href="/tickets"
                    className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    All Tickets
                  </a>
                  <a
                    href="/api/docs"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    API Docs ↗
                  </a>
                </nav>
              </div>
            </div>
          </header>

          {/* Body: sidebar + main */}
          <div className="flex flex-1 overflow-hidden">
            {/* Persistent sidebar */}
            {properties.length > 0 && (
              <PropertySidebar properties={properties} />
            )}

            {/* Main content */}
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
