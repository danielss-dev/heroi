import type { DiffOutput } from "../../types";

interface DiffPreviewProps {
  diff: DiffOutput | null;
  loading: boolean;
}

export function DiffPreview({ diff, loading }: DiffPreviewProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <span className="text-xs text-zinc-500">Loading diff...</span>
      </div>
    );
  }

  if (!diff || !diff.diff_text) {
    return (
      <div className="flex items-center justify-center p-4">
        <span className="text-xs text-zinc-500">
          Select a file to view changes
        </span>
      </div>
    );
  }

  const lines = diff.diff_text.split("\n");

  return (
    <div className="overflow-auto font-mono text-[11px] leading-[18px]">
      {lines.map((line, i) => {
        let className = "px-3 whitespace-pre ";
        if (line.startsWith("+")) {
          className += "bg-green-950/40 text-green-300";
        } else if (line.startsWith("-")) {
          className += "bg-red-950/40 text-red-300";
        } else if (line.startsWith("@@")) {
          className += "bg-blue-950/30 text-blue-400";
        } else if (line.startsWith("diff") || line.startsWith("index")) {
          className += "bg-zinc-800/50 text-zinc-500";
        } else {
          className += "text-zinc-400";
        }
        return (
          <div key={i} className={className}>
            {line}
          </div>
        );
      })}
    </div>
  );
}
