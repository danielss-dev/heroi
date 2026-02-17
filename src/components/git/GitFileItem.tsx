import { Plus, Minus, FileText, ExternalLink } from "lucide-react";
import type { GitFileStatus, FileState } from "../../types";
import { useAppStore } from "../../stores/useAppStore";
import { openFileInIde } from "../../lib/tauri";

interface GitFileItemProps {
  file: GitFileStatus;
  isSelected: boolean;
  onSelect: (path: string) => void;
  onStage: (path: string) => void;
  onUnstage: (path: string) => void;
  worktreePath: string;
}

function stateColor(state: FileState): string {
  switch (state) {
    case "Added":
    case "Untracked":
      return "text-green-400";
    case "Modified":
      return "text-yellow-400";
    case "Deleted":
      return "text-red-400";
    case "Renamed":
      return "text-blue-400";
    case "Conflicted":
      return "text-orange-400";
    default:
      return "text-zinc-400";
  }
}

function stateLabel(state: FileState): string {
  switch (state) {
    case "Added":
      return "A";
    case "Modified":
      return "M";
    case "Deleted":
      return "D";
    case "Renamed":
      return "R";
    case "Untracked":
      return "?";
    case "Conflicted":
      return "!";
    case "Typechange":
      return "T";
    default:
      return "";
  }
}

export function GitFileItem({
  file,
  isSelected,
  onSelect,
  onStage,
  onUnstage,
  worktreePath,
}: GitFileItemProps) {
  const defaultIde = useAppStore((s) => s.settings.defaultIde);
  const hasStaged = file.staged !== "Unmodified";
  const hasUnstaged = file.unstaged !== "Unmodified";
  const displayState = hasUnstaged ? file.unstaged : file.staged;

  const fileName = file.path.includes("/")
    ? file.path.substring(file.path.lastIndexOf("/") + 1)
    : file.path;

  const handleOpenInEditor = (e: React.MouseEvent) => {
    e.stopPropagation();
    openFileInIde(worktreePath, file.path, defaultIde).catch((err) =>
      console.error("Failed to open in editor:", err)
    );
  };

  return (
    <div
      onClick={() => onSelect(file.path)}
      className={`group flex items-center gap-1.5 px-2 py-0.5 text-xs cursor-pointer transition-colors ${
        isSelected
          ? "bg-indigo-500/15 text-zinc-200"
          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
      }`}
    >
      <FileText size={12} className={`shrink-0 ${stateColor(displayState)}`} />
      <span className="truncate flex-1" title={file.path}>
        {fileName}
      </span>
      <span
        className={`text-[10px] font-mono shrink-0 ${stateColor(displayState)}`}
      >
        {stateLabel(displayState)}
      </span>
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
        <button
          onClick={handleOpenInEditor}
          className="p-0.5 text-zinc-500 hover:text-zinc-300"
          title="Open in editor"
        >
          <ExternalLink size={11} />
        </button>
        {hasUnstaged && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStage(file.path);
            }}
            className="p-0.5 text-green-500 hover:text-green-400"
            title="Stage file"
          >
            <Plus size={12} />
          </button>
        )}
        {hasStaged && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnstage(file.path);
            }}
            className="p-0.5 text-orange-500 hover:text-orange-400"
            title="Unstage file"
          >
            <Minus size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
