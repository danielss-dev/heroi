interface UnifiedDiffProps {
  diffText: string;
  filePath: string;
}

interface DiffLine {
  type: "added" | "removed" | "context" | "header";
  content: string;
  oldLineNo: number | null;
  newLineNo: number | null;
}

function parseDiffLines(diffText: string): DiffLine[] {
  const rawLines = diffText.split("\n");
  const lines: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const raw of rawLines) {
    if (raw.startsWith("@@")) {
      // Parse hunk header: @@ -start,count +start,count @@
      const match = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      lines.push({ type: "header", content: raw, oldLineNo: null, newLineNo: null });
    } else if (raw.startsWith("+")) {
      lines.push({ type: "added", content: raw.slice(1), oldLineNo: null, newLineNo: newLine });
      newLine++;
    } else if (raw.startsWith("-")) {
      lines.push({ type: "removed", content: raw.slice(1), oldLineNo: oldLine, newLineNo: null });
      oldLine++;
    } else if (raw.startsWith(" ")) {
      lines.push({ type: "context", content: raw.slice(1), oldLineNo: oldLine, newLineNo: newLine });
      oldLine++;
      newLine++;
    } else if (raw.startsWith("diff ") || raw.startsWith("index ") || raw.startsWith("---") || raw.startsWith("+++")) {
      lines.push({ type: "header", content: raw, oldLineNo: null, newLineNo: null });
    }
  }

  return lines;
}

const lineColors: Record<DiffLine["type"], string> = {
  added: "bg-green-950/40 text-green-300",
  removed: "bg-red-950/40 text-red-300",
  context: "text-zinc-400",
  header: "bg-zinc-800/50 text-indigo-400",
};

export function UnifiedDiff({ diffText, filePath }: UnifiedDiffProps) {
  const lines = parseDiffLines(diffText);

  if (lines.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
        No diff available for {filePath}
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full font-mono text-xs leading-5">
      {lines.map((line, i) => (
        <div key={i} className={`flex ${lineColors[line.type]}`}>
          <span className="w-12 text-right pr-2 text-zinc-600 select-none shrink-0 border-r border-zinc-800">
            {line.oldLineNo ?? ""}
          </span>
          <span className="w-12 text-right pr-2 text-zinc-600 select-none shrink-0 border-r border-zinc-800">
            {line.newLineNo ?? ""}
          </span>
          <span className="w-5 text-center select-none shrink-0 text-zinc-600">
            {line.type === "added" ? "+" : line.type === "removed" ? "-" : line.type === "header" ? "" : " "}
          </span>
          <span className="flex-1 whitespace-pre pl-1">{line.content}</span>
        </div>
      ))}
    </div>
  );
}
