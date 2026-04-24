import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buena ContextOps",
  description: "Human-reviewed property memory for AI operations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">B</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900 text-lg">Buena</span>
                    <span className="text-brand-600 font-semibold text-lg"> ContextOps</span>
                  </div>
                </div>
                <nav className="flex items-center gap-6">
                  <a
                    href="/"
                    className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    Properties
                  </a>
                  <a
                    href="/tickets"
                    className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    Tickets
                  </a>
                  <a
                    href="/api/docs"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    API Docs
                  </a>
                </nav>
              </div>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-slate-200 bg-white mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <p className="text-sm text-slate-400 text-center">
                Buena ContextOps — Human-in-the-loop property context engine
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
