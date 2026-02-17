import { FilePlus, FileMinus, FileEdit } from "lucide-react";
import type { DiffOutput } from "../../types";

interface DiffFileTreeProps {
  diffs: DiffOutput[];
  selectedFile: string | null;
  onSelectFile: (filePath: string) => void;
}

function getFileStatus(diffText: string): "added" | "deleted" | "modified" {
  const hasAdded = diffText.includes("\n+");
  const hasRemoved = diffText.includes("\n-");
  if (hasAdded && !hasRemoved) return "added";
  if (!hasAdded && hasRemoved) return "deleted";
  return "modified";
}

function getStatusIcon(status: "added" | "deleted" | "modified") {
  switch (status) {
    case "added":
      return <FilePlus size={13} className="text-green-500" />;
    case "deleted":
      return <FileMinus size={13} className="text-red-500" />;
    case "modified":
      return <FileEdit size={13} className="text-yellow-500" />;
  }
}

function getFileName(filePath: string): string {
  return filePath.split("/").pop() ?? filePath;
}

function getDirectory(filePath: string): string {
  const parts = filePath.split("/");
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}

export function DiffFileTree({
  diffs,
  selectedFile,
  onSelectFile,
}: DiffFileTreeProps) {
  // Group files by directory
  const grouped = new Map<string, DiffOutput[]>();
  for (const diff of diffs) {
    const dir = getDirectory(diff.file_path);
    const list = grouped.get(dir) ?? [];
    list.push(diff);
    grouped.set(dir, list);
  }

  const sortedDirs = [...grouped.keys()].sort();

  return (
    <div className="flex flex-col text-xs">
      <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold border-b border-zinc-800">
        Changed Files ({diffs.length})
      </div>
      <div className="overflow-y-auto flex-1">
        {sortedDirs.map((dir) => (
          <div key={dir}>
            {dir && (
              <div className="px-3 py-1 text-[10px] text-zinc-600 truncate">
                {dir}/
              </div>
            )}
            {grouped.get(dir)!.map((diff) => {
              const status = getFileStatus(diff.diff_text);
              const isSelected = diff.file_path === selectedFile;
              return (
                <button
                  key={diff.file_path}
                  onClick={() => onSelectFile(diff.file_path)}
                  className={`flex items-center gap-2 w-full px-3 py-1 text-left transition-colors ${
                    isSelected
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
                >
                  {getStatusIcon(status)}
                  <span className="truncate">
                    {getFileName(diff.file_path)}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
        {diffs.length === 0 && (
          <div className="px-3 py-4 text-zinc-600 text-center">
            No changes
          </div>
        )}
      </div>
    </div>
  );
}
