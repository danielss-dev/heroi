import { useState } from "react";
import { ChevronRight, Folder } from "lucide-react";
import type { ReactNode } from "react";

interface FileTreeGroupProps {
  directory: string;
  children: ReactNode;
}

export function FileTreeGroup({ directory, children }: FileTreeGroupProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 w-full px-2 py-0.5 text-[10px] text-zinc-500 hover:text-zinc-400 transition-colors"
      >
        <ChevronRight
          size={10}
          className={`transition-transform ${expanded ? "rotate-90" : ""}`}
        />
        <Folder size={10} />
        <span className="truncate">{directory}</span>
      </button>
      {expanded && <div>{children}</div>}
    </div>
  );
}
