"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@repo/ui/components/card";
import { Button } from "@repo/ui/components/button";
import { Badge } from "@repo/ui/components/badge";
import { FileText, Upload, Sparkles } from "lucide-react";

export default function ExtractPage() {
  const [uploaded, setUploaded] = useState(false);

  return (
    <div>
      <PageHeader title="PDF Extract" subtitle="Drop owner protocols, invoices, contracts — Hermes routes facts to the right context layer" />
      <div className="grid grid-cols-3 gap-6 p-8">
        <div className="col-span-2 space-y-4">
          {!uploaded ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Upload className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="mb-4 text-sm text-muted-foreground">Drop a PDF here, or</p>
                <Button onClick={() => setUploaded(true)}>Select file</Button>
                <p className="mt-3 text-xs text-muted-foreground">Supports WEG protocols, invoices, vendor contracts, tenant correspondence</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">WEG-Protokoll-2026-03.pdf</div>
                      <div className="text-xs text-muted-foreground">142 KB · 8 pages · uploaded just now</div>
                    </div>
                    <Badge variant="success">extracted</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-700" />
                    <h3 className="text-sm font-semibold">12 facts extracted — proposed routing</h3>
                  </div>
                  <ul className="divide-y">
                    {[
                      { layer: "Owner",    text: "Approved €4,200 façade painting (5-year cycle)",   conf: 0.94 },
                      { layer: "Owner",    text: "Renewed Heinz GmbH HVAC contract (3 years)",       conf: 0.91 },
                      { layer: "Building", text: "Vaillant boiler service due 2026-09",              conf: 0.88 },
                      { layer: "Property", text: "Mobility flag added for Unit 3B (Herr Schmidt)",   conf: 0.96 },
                      { layer: "Owner",    text: "Auto-approval threshold raised to €200",           conf: 0.85 },
                    ].map((f, i) => (
                      <li key={i} className="flex items-center gap-3 py-3">
                        <Badge variant="muted">{f.layer}</Badge>
                        <span className="flex-1 text-sm">{f.text}</span>
                        <span className="font-mono text-xs text-muted-foreground">{Math.round(f.conf * 100)}%</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex gap-2">
                    <Button variant="success">Apply all to context.md</Button>
                    <Button variant="outline">Review one by one</Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
        <aside>
          <Card><CardContent className="p-4 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Routing rules</div>
            <ul className="mt-2 space-y-2 text-xs">
              <li>Board decisions → <strong>Owner</strong></li>
              <li>System changes → <strong>Building</strong></li>
              <li>Tenant flags → <strong>Property</strong></li>
              <li>Vendor SLAs → <strong>Vendor</strong></li>
            </ul>
          </CardContent></Card>
        </aside>
      </div>
    </div>
  );
}
