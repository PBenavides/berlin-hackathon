import { notFound } from "next/navigation";
import Link from "next/link";
import { MarkdownRenderer } from "../../../components/MarkdownRenderer";
import { DiffViewer } from "../../../components/DiffViewer";

const API_BASE = process.env.BACKEND_URL || "http://localhost:8000";

interface Property {
  id: string;
  name: string;
  slack_channel: string | null;
}

interface ContextVersion {
  id: string;
  property_id: string;
  version: number;
  content_md: string;
  frontmatter: Record<string, unknown> | null;
  created_by: string;
  created_reason: string | null;
  created_at: string;
  parent_version: number | null;
  source_proposal_id: string | null;
}

interface DiffResult {
  from_version: number;
  to_version: number;
  diff: string;
}

async function getProperty(id: string): Promise<Property | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/properties/${id}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getLatestContext(propertyId: string): Promise<ContextVersion | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/properties/${propertyId}/context`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getContextVersions(propertyId: string): Promise<ContextVersion[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/properties/${propertyId}/context/versions`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function getDiff(
  propertyId: string,
  fromVersion: number,
  toVersion: number
): Promise<DiffResult | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/properties/${propertyId}/context/diff?from=${fromVersion}&to=${toVersion}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-DE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ContextPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { version?: string; showDiff?: string };
}) {
  const { id } = params;

  const [property, versions] = await Promise.all([
    getProperty(id),
    getContextVersions(id),
  ]);

  if (!property) notFound();

  // Determine which version to show
  const requestedVersion = searchParams.version
    ? parseInt(searchParams.version, 10)
    : null;

  let activeContext: ContextVersion | null = null;

  if (requestedVersion !== null) {
    activeContext =
      versions.find((v) => v.version === requestedVersion) ?? null;
  } else {
    activeContext = versions[0] ?? null; // versions are desc order
  }

  if (!activeContext && versions.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">No context document found for this property.</p>
        <p className="text-sm text-slate-400 mt-2">
          Context is created automatically when the first ticket is resolved.
        </p>
      </div>
    );
  }

  // Compute diff vs previous version if requested or if multiple versions exist
  const showDiff = searchParams.showDiff === "1";
  let diff: DiffResult | null = null;

  if (activeContext && showDiff && activeContext.parent_version !== null) {
    diff = await getDiff(id, activeContext.parent_version, activeContext.version);
  } else if (activeContext && showDiff && versions.length >= 2) {
    const prevVersion = versions.find((v) => v.version === activeContext!.version - 1);
    if (prevVersion) {
      diff = await getDiff(id, prevVersion.version, activeContext.version);
    }
  }

  const latestVersion = versions[0]?.version ?? 1;
  const isLatest = activeContext?.version === latestVersion;

  return (
    <div className="min-h-full">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <nav className="flex items-center gap-2 text-sm text-slate-500 mb-3">
          <a href="/" className="hover:text-slate-900 transition-colors">
            Properties
          </a>
          <span>/</span>
          <span className="text-slate-900 font-medium">{property.name}</span>
          <span>/</span>
          <span className="text-slate-600">Context</span>
        </nav>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{property.name}</h1>
            {property.slack_channel && (
              <p className="text-sm text-slate-400 mt-0.5">{property.slack_channel}</p>
            )}
          </div>
          {activeContext && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {!showDiff ? (
                <Link
                  href={`/properties/${id}/context?showDiff=1${requestedVersion ? `&version=${requestedVersion}` : ""}`}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700 px-3 py-1.5 border border-brand-200 rounded-lg transition-colors"
                >
                  Show Diff ↕
                </Link>
              ) : (
                <Link
                  href={`/properties/${id}/context${requestedVersion ? `?version=${requestedVersion}` : ""}`}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 border border-slate-200 rounded-lg transition-colors"
                >
                  Hide Diff
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-0">
        {/* Main: context content */}
        <div className="flex-1 px-6 py-6 max-w-3xl">
          {activeContext && (
            <>
              {/* Frontmatter header bar — parsed from version metadata */}
              {activeContext.frontmatter && Object.keys(activeContext.frontmatter).length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-5">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Document Metadata
                  </p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                    {Object.entries(activeContext.frontmatter).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-1.5 text-xs">
                        <span className="font-medium text-slate-500 capitalize">{k.replace(/_/g, " ")}:</span>
                        <span className="text-slate-700 font-mono">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Version indicator */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                    v{activeContext.version}
                  </span>
                  {isLatest && (
                    <span className="bg-green-50 border border-green-200 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                      Latest
                    </span>
                  )}
                  {!isLatest && (
                    <Link
                      href={`/properties/${id}/context`}
                      className="text-xs text-amber-600 hover:text-amber-700 font-medium bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"
                    >
                      ← View latest (v{latestVersion})
                    </Link>
                  )}
                </div>
                <div className="text-right text-xs text-slate-400">
                  <p>
                    by <span className="font-medium text-slate-600">{activeContext.created_by}</span>
                  </p>
                  <p>{formatDate(activeContext.created_at)}</p>
                </div>
              </div>

              {activeContext.created_reason && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 mb-4 text-xs text-slate-600 flex items-start gap-2">
                  <span className="text-slate-400 flex-shrink-0">✎</span>
                  <span>
                    <span className="font-medium text-slate-500">Change reason:</span>{" "}
                    {activeContext.created_reason}
                  </span>
                </div>
              )}

              {activeContext.source_proposal_id && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 mb-4 text-xs text-blue-700 flex items-center gap-2">
                  <span>🔗</span>
                  <span>
                    Context updated from proposal{" "}
                    <span className="font-mono font-semibold">{activeContext.source_proposal_id.slice(0, 8)}…</span>
                  </span>
                </div>
              )}

              {/* Diff viewer */}
              {showDiff && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-slate-700">
                      Diff: v{diff?.from_version ?? "?"} → v{activeContext.version}
                    </h2>
                  </div>
                  {diff ? (
                    <DiffViewer
                      diff={diff.diff}
                      fromVersion={diff.from_version}
                      toVersion={diff.to_version}
                    />
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-4">
                      {activeContext.parent_version === null
                        ? "This is the first version — no diff available."
                        : "Could not load diff."}
                    </p>
                  )}
                  <hr className="my-6 border-slate-200" />
                </div>
              )}

              {/* Markdown content */}
              <div className="card p-6">
                <MarkdownRenderer content={activeContext.content_md} />
              </div>
            </>
          )}
        </div>

        {/* Right panel: version history */}
        <div className="w-64 flex-shrink-0 border-l border-slate-200 bg-white px-4 py-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Version History
            </h3>
            <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5 font-semibold">
              {versions.length}
            </span>
          </div>
          {versions.length === 0 ? (
            <p className="text-xs text-slate-400">No versions yet.</p>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => {
                const isActive = activeContext?.version === v.version;
                return (
                  <div
                    key={v.id}
                    className={`rounded-lg border transition-colors ${
                      isActive
                        ? "bg-brand-50 border-brand-200"
                        : "border-slate-100 hover:border-slate-200"
                    }`}
                  >
                    <Link
                      href={`/properties/${id}/context?version=${v.version}${showDiff ? "&showDiff=1" : ""}`}
                      className="block p-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-bold ${
                            isActive ? "text-brand-700" : "text-slate-700"
                          }`}
                        >
                          v{v.version}
                        </span>
                        {v.version === latestVersion && (
                          <span className="text-xs text-green-600 font-medium">Latest</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {v.created_by}
                      </p>
                      {v.created_reason && (
                        <p className="text-xs text-slate-400 truncate mt-0.5 italic">
                          &ldquo;{v.created_reason}&rdquo;
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(v.created_at).toLocaleDateString("en-DE", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </Link>
                    {/* Quick diff link for non-first versions */}
                    {v.parent_version !== null && (
                      <div className="border-t border-slate-100 px-3 py-1.5">
                        <Link
                          href={`/properties/${id}/context?version=${v.version}&showDiff=1`}
                          className="text-xs text-brand-500 hover:text-brand-700 font-medium flex items-center gap-1"
                        >
                          ↕ Diff vs v{v.parent_version}
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
