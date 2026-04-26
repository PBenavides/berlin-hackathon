"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@repo/ui/components/card";
import { Button } from "@repo/ui/components/button";
import { Badge } from "@repo/ui/components/badge";
import { api, friendlyApiError, type ExtractDiff, type ExtractResult } from "@/lib/api";
import { useToast } from "@/components/toaster";
import type { Layer, Property } from "@/lib/types";
import { Upload, Loader2, FileText, RefreshCw } from "lucide-react";

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 60;

const LAYER_OPTIONS: Array<{ value: "" | Layer; label: string }> = [
  { value: "",         label: "Auto-detect" },
  { value: "vendor",   label: "Vendor" },
  { value: "owner",    label: "Owner" },
  { value: "building", label: "Building" },
  { value: "property", label: "Property" },
];

export default function ExtractPage() {
  const { push: pushToast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState<string>("");
  const [layer, setLayer] = useState<"" | Layer>("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [extractionId, setExtractionId] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const cancelledRef = useRef(false);

  function reportError(err: unknown, action: "extract" = "extract") {
    const friendly = friendlyApiError(err, action);
    pushToast({ ...friendly, variant: "destructive" });
  }

  useEffect(() => {
    let cancelled = false;
    api.properties.list()
      .then((list) => { if (!cancelled) setProperties(list); })
      .catch(() => { /* leave empty */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => { cancelledRef.current = true; }, []);

  async function handleSubmit() {
    if (!file) return;
    setSubmitting(true);
    setResult(null);
    setExtractionId(null);
    cancelledRef.current = false;

    try {
      const start = await api.extract.start(file, {
        propertyId: propertyId || undefined,
        layer: layer || undefined,
      });
      setExtractionId(start.extractionId);
      setSubmitting(false);
      setPolling(true);
      await pollUntilDone(start.extractionId);
    } catch (err) {
      setSubmitting(false);
      setPolling(false);
      reportError(err);
    }
  }

  async function pollUntilDone(id: string) {
    for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
      if (cancelledRef.current) return;
      try {
        const r = await api.extract.poll(id);
        setResult(r);
        if (r.status === "done" || r.status === "error") {
          setPolling(false);
          if (r.status === "error" && r.error) {
            pushToast({ title: "Extraction failed", description: r.error, variant: "destructive" });
          }
          return;
        }
      } catch (err) {
        setPolling(false);
        reportError(err);
        return;
      }
      await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
    }
    setPolling(false);
    pushToast({ title: "Extraction timed out", description: "Please retry.", variant: "destructive" });
  }

  function reset() {
    cancelledRef.current = true;
    setFile(null);
    setSubmitting(false);
    setPolling(false);
    setResult(null);
    setExtractionId(null);
  }

  const busy = submitting || polling;

  return (
    <div>
      <PageHeader
        title="PDF Extract"
        subtitle="Upload a PDF and let the extractor propose context.md diffs"
      />
      <div className="grid grid-cols-3 gap-6 p-8">
        <Card className="col-span-1">
          <CardContent className="space-y-4 p-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target property</label>
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                disabled={busy}
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              >
                <option value="">Auto-detect</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hint layer</label>
              <select
                value={layer}
                onChange={(e) => setLayer(e.target.value as "" | Layer)}
                disabled={busy}
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              >
                {LAYER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">PDF file</label>
              <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-md border border-dashed bg-background px-3 py-3 text-sm text-muted-foreground hover:border-foreground/40">
                <Upload className="h-4 w-4" />
                <span className="truncate">{file ? file.name : "Choose a PDF"}</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => void handleSubmit()} disabled={!file || busy} className="flex-1">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {submitting ? "Uploading…" : "Extract"}
              </Button>
              <Button variant="outline" onClick={reset} disabled={!file && !result && !busy}>
                <RefreshCw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="col-span-2 space-y-4">
          {extractionId && (
            <Card>
              <CardContent className="flex items-center justify-between p-4 text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-xs">{extractionId}</span>
                </div>
                <div className="flex items-center gap-2">
                  {polling && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  <Badge variant={
                    result?.status === "done"  ? "success"
                  : result?.status === "error" ? "destructive"
                  : "muted"}>
                    {result?.status ?? "starting"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {result?.status === "done" && (result.proposedDiffs?.length ?? 0) === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No diffs proposed.
              </CardContent>
            </Card>
          )}

          {result?.proposedDiffs?.map((d, i) => <DiffCard key={i} diff={d} />)}

          {!extractionId && (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Upload a PDF to see proposed diffs against context.md.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function DiffCard({ diff }: { diff: ExtractDiff }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="muted" className="capitalize">{diff.layer}</Badge>
            <span className="text-sm font-semibold">{diff.heading}</span>
          </div>
          <Badge variant="outline" className="font-mono">conf {Math.round(diff.confidence * 100)}%</Badge>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">{diff.rationale}</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded border-l-2 border-red-300 bg-red-500/5 px-3 py-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">Before</div>
            <div className="whitespace-pre-wrap">{diff.before || <span className="italic text-muted-foreground">empty</span>}</div>
          </div>
          <div className="rounded border-l-2 border-emerald-300 bg-emerald-500/5 px-3 py-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">After</div>
            <div className="whitespace-pre-wrap">{diff.after}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
