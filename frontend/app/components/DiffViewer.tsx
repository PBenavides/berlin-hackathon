"use client";

interface DiffViewerProps {
  diff: string;
  fromVersion: number;
  toVersion: number;
}

export function DiffViewer({ diff, fromVersion, toVersion }: DiffViewerProps) {
  if (!diff || diff.trim() === "") {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        No differences between these versions.
      </div>
    );
  }

  const lines = diff.split("\n");

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-100 border border-red-300" />
          <span className="text-slate-500">Removed (v{fromVersion})</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-100 border border-green-300" />
          <span className="text-slate-500">Added (v{toVersion})</span>
        </span>
      </div>
      <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <pre className="text-xs leading-relaxed p-0">
            {lines.map((line, i) => {
              let lineClass = "text-slate-400 bg-transparent";
              let prefix = " ";

              if (line.startsWith("+++") || line.startsWith("---")) {
                lineClass = "text-slate-500 bg-slate-900";
              } else if (line.startsWith("@@")) {
                lineClass = "text-brand-400 bg-slate-900";
                prefix = "";
              } else if (line.startsWith("+")) {
                lineClass = "text-green-300 bg-green-950";
              } else if (line.startsWith("-")) {
                lineClass = "text-red-300 bg-red-950";
              }

              return (
                <div
                  key={i}
                  className={`flex ${lineClass} px-4 py-px`}
                >
                  <span className="select-none w-8 flex-shrink-0 text-slate-600 text-right mr-4">
                    {i + 1}
                  </span>
                  <span className="flex-1 whitespace-pre">{line}</span>
                </div>
              );
            })}
          </pre>
        </div>
      </div>
    </div>
  );
}
