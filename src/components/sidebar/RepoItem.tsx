import { useState, useEffect } from "react";
import { ChevronRight, FolderGit2, Plus, Trash2 } from "lucide-react";
import type { RepoEntry, WorktreeInfo } from "../../types";
import { useAppStore } from "../../stores/useAppStore";
import { WorktreeItem } from "./WorktreeItem";
import { CreateWorktreeDialog } from "./CreateWorktreeDialog";
import { useRepos } from "../../hooks/useRepos";

interface RepoItemProps {
  repo: RepoEntry;
}

export function RepoItem({ repo }: RepoItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const { worktrees, selectedRepo, selectRepo } = useAppStore();
  const { loadWorktrees, createWorktree, removeWorktree, removeRepo } =
    useRepos();

  const allWorktrees: WorktreeInfo[] = worktrees[repo.path] || [];
  // Only show non-main worktrees in the list
  const createdWorktrees = allWorktrees.filter((wt) => !wt.is_main);

  useEffect(() => {
    if (expanded) {
      loadWorktrees(repo.path);
    }
  }, [expanded, repo.path, loadWorktrees]);

  const handleToggle = () => {
    setExpanded(!expanded);
    selectRepo(repo.path);
  };

  return (
    <div>
      <div
        className={`group flex items-center gap-1.5 px-2 py-1 cursor-pointer transition-colors ${
          selectedRepo === repo.path
            ? "bg-zinc-800 text-zinc-100"
            : "text-zinc-300 hover:bg-zinc-800/50"
        }`}
        onClick={handleToggle}
      >
        <ChevronRight
          size={14}
          className={`shrink-0 text-zinc-500 transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
        />
        <FolderGit2 size={14} className="shrink-0 text-zinc-500" />
        <span className="text-xs truncate flex-1">{repo.name}</span>
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDialog(true);
            }}
            className="p-0.5 text-zinc-500 hover:text-zinc-200 transition-colors"
            title="New worktree"
          >
            <Plus size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeRepo(repo.path);
            }}
            className="p-0.5 text-zinc-500 hover:text-red-400 transition-colors"
            title="Remove repository"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="py-0.5">
          {createdWorktrees.length === 0 ? (
            <div className="pl-8 pr-2 py-1.5 text-[11px] text-zinc-600 italic">
              No worktrees yet
            </div>
          ) : (
            createdWorktrees.map((wt) => (
              <WorktreeItem
                key={wt.path}
                worktree={wt}
                repoPath={repo.path}
                onRemove={removeWorktree}
              />
            ))
          )}
        </div>
      )}

      <CreateWorktreeDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        onSubmit={(name, branch, baseBranch) =>
          createWorktree(repo.path, name, branch, baseBranch)
        }
        repoPath={repo.path}
        repoName={repo.name}
      />
    </div>
  );
}
