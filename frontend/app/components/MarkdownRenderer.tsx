import React from "react";

/**
 * Simple server-side markdown renderer for context.md content.
 * Handles headings, lists, horizontal rules, bold, code, and paragraphs.
 */

function inlineFormat(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const raw = match[0];
    if (raw.startsWith("**")) {
      parts.push(
        <strong key={key++} className="font-semibold text-slate-900">
          {raw.slice(2, -2)}
        </strong>
      );
    } else if (raw.startsWith("`")) {
      parts.push(
        <code
          key={key++}
          className="bg-slate-100 text-slate-700 text-xs px-1 py-0.5 rounded font-mono"
        >
          {raw.slice(1, -1)}
        </code>
      );
    }
    last = match.index + raw.length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

export function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" = "ul";
  let key = 0;
  let inFrontmatter = false;
  const frontmatterLines: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      if (listType === "ul") {
        nodes.push(
          <ul key={key++} className="list-disc list-inside space-y-1 my-2 ml-2">
            {listItems.map((item, i) => (
              <li key={i} className="text-sm text-slate-700 leading-relaxed">
                {inlineFormat(item)}
              </li>
            ))}
          </ul>
        );
      } else {
        nodes.push(
          <ol key={key++} className="list-decimal list-inside space-y-1 my-2 ml-2">
            {listItems.map((item, i) => (
              <li key={i} className="text-sm text-slate-700 leading-relaxed">
                {inlineFormat(item)}
              </li>
            ))}
          </ol>
        );
      }
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle YAML frontmatter at top of document
    if (i === 0 && line.trim() === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (line.trim() === "---") {
        inFrontmatter = false;
        nodes.push(
          <div
            key={key++}
            className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-5 text-xs font-mono space-y-0.5"
          >
            <p className="text-slate-400 font-semibold mb-1 uppercase tracking-wider text-xs">
              Frontmatter
            </p>
            {frontmatterLines.map((fl, fi) => {
              const colonIdx = fl.indexOf(":");
              const fKey = colonIdx > -1 ? fl.slice(0, colonIdx) : fl;
              const fVal = colonIdx > -1 ? fl.slice(colonIdx + 1).trim() : "";
              return (
                <div key={fi} className="flex gap-2">
                  <span className="font-semibold text-slate-500">{fKey}:</span>
                  <span className="text-slate-600">{fVal}</span>
                </div>
              );
            })}
          </div>
        );
      } else {
        frontmatterLines.push(line);
      }
      continue;
    }

    if (line.startsWith("# ")) {
      flushList();
      const text = line.slice(2);
      const anchor = text
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      nodes.push(
        <h1
          key={key++}
          id={anchor}
          className="text-2xl font-bold text-slate-900 mt-6 mb-3 pb-2 border-b border-slate-200"
        >
          {inlineFormat(text)}
        </h1>
      );
    } else if (line.startsWith("## ")) {
      flushList();
      const text = line.slice(3);
      const anchor = text
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      nodes.push(
        <h2
          key={key++}
          id={anchor}
          className="text-lg font-semibold text-slate-800 mt-6 mb-2 flex items-center gap-2 group"
        >
          <span className="w-1 h-5 bg-brand-400 rounded-full flex-shrink-0" />
          {inlineFormat(text)}
          <a
            href={`#${anchor}`}
            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-slate-500 text-sm transition-opacity ml-1"
            aria-label={`Link to section ${text}`}
          >
            #
          </a>
        </h2>
      );
    } else if (line.startsWith("### ")) {
      flushList();
      nodes.push(
        <h3 key={key++} className="text-base font-semibold text-slate-700 mt-4 mb-1.5">
          {inlineFormat(line.slice(4))}
        </h3>
      );
    } else if (line.startsWith("#### ")) {
      flushList();
      nodes.push(
        <h4
          key={key++}
          className="text-sm font-semibold text-slate-600 mt-3 mb-1 uppercase tracking-wide"
        >
          {inlineFormat(line.slice(5))}
        </h4>
      );
    } else if (line.trim() === "---" || line.trim() === "***") {
      flushList();
      nodes.push(<hr key={key++} className="my-5 border-slate-200" />);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      listType = "ul";
      listItems.push(line.slice(2));
    } else if (/^\d+\.\s/.test(line)) {
      listType = "ol";
      listItems.push(line.replace(/^\d+\.\s/, ""));
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      nodes.push(
        <p key={key++} className="text-sm text-slate-700 my-1.5 leading-relaxed">
          {inlineFormat(line)}
        </p>
      );
    }
  }

  flushList();

  return <div>{nodes}</div>;
}
