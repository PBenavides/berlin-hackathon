import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/toaster";
import { AutoSolveProvider } from "@/lib/auto-solve-context";
import { ActivityFeed } from "@/components/activity-feed";
import { DemoControlBar } from "@/components/demo-control-bar";
import { AgentSummaryPanel } from "@/components/agent-summary-panel";

const geist = Geist({ subsets: ["latin"], variable: "--font-inter" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "Buena Context Engine",
  description: "AI-powered property management — context-first ticket resolution",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} ${mono.variable} font-sans antialiased bg-background text-foreground`}>
        <ThemeProvider>
          <AutoSolveProvider>
            <Toaster>
              <div className="flex h-screen overflow-hidden">
                <Sidebar />
                <main className="flex-1 overflow-auto">{children}</main>
              </div>
              {/* Sprint 3: Global agent activity feed panel */}
              <ActivityFeed />
              {/* Sprint 4: Demo control bar (s4-f3 + s4-f5) */}
              <DemoControlBar />
              {/* Sprint 4: Agent summary panel (s4-f1) */}
              <AgentSummaryPanel />
            </Toaster>
          </AutoSolveProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
