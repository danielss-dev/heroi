import { GitBranch, Trash2 } from "lucide-react";
import type { WorktreeInfo } from "../../types";
import { useAppStore } from "../../stores/useAppStore";

interface WorktreeItemProps {
  worktree: WorktreeInfo;
  repoPath: string;
  onRemove: (repoPath: string, worktreePath: string) => Promise<void>;
}

export function WorktreeItem({ worktree, repoPath, onRemove }: WorktreeItemProps) {
  const { selectedWorktree, selectWorktree } = useAppStore();
  const isSelected = selectedWorktree?.path === worktree.path;

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Deselect if this worktree is currently selected
    if (isSelected) {
      selectWorktree(null);
    }
    try {
      await onRemove(repoPath, worktree.path);
    } catch (err) {
      console.error("Failed to remove worktree:", err);
    }
  };

  return (
    <div
      onClick={() => selectWorktree(worktree)}
      className={`group flex items-center gap-2 pl-8 pr-2 py-1 text-xs cursor-pointer transition-colors ${
        isSelected
          ? "bg-indigo-500/15 text-indigo-300"
          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
      }`}
    >
      <GitBranch size={12} className="shrink-0" />
      <span className="truncate flex-1">
        {worktree.branch || worktree.name}
      </span>
      <button
        onClick={handleRemove}
        className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-500 hover:text-red-400 transition-all"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}
