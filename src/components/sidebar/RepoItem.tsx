import { useState, useEffect } from "react";
import { ChevronRight, FolderGit2, Plus, Trash2 } from "lucide-react";
import type { RepoEntry } from "../../types";
import { useAppStore } from "../../stores/useAppStore";
import { useWorkspaceActions } from "../../hooks/useWorkspaceActions";
import { useRepos } from "../../hooks/useRepos";
import { WorkspaceItem } from "./WorkspaceItem";
import { CreateWorkspaceDialog } from "../workspace/CreateWorkspaceDialog";

interface RepoItemProps {
  repo: RepoEntry;
}

export function RepoItem({ repo }: RepoItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const { selectedRepo, selectRepo } = useAppStore();
  const { removeRepo } = useRepos();

  const {
    activeWorkspaceId,
    getWorkspacesForRepo,
    createWorkspace,
    switchWorkspace,
    renameWorkspace,
    archiveWorkspace,
    deleteWorkspace,
  } = useWorkspaceActions();

  const repoWorkspaces = getWorkspacesForRepo(repo.path);
  const activeWorkspaces = repoWorkspaces.filter((ws) => ws.status === "active");
  const hasActiveWorkspace = repoWorkspaces.some((ws) => ws.id === activeWorkspaceId);

  // Auto-expand if this repo contains the active workspace
  useEffect(() => {
    if (hasActiveWorkspace && !expanded) {
      setExpanded(true);
    }
  }, [hasActiveWorkspace]);

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
            title="New workspace"
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
          {activeWorkspaces.length === 0 ? (
            <div className="pl-8 pr-2 py-1.5 text-[11px] text-zinc-600 italic">
              No workspaces yet
            </div>
          ) : (
            activeWorkspaces.map((ws) => (
              <WorkspaceItem
                key={ws.id}
                workspace={ws}
                onSwitch={switchWorkspace}
                onRename={renameWorkspace}
                onArchive={archiveWorkspace}
                onDelete={deleteWorkspace}
              />
            ))
          )}
        </div>
      )}

      <CreateWorkspaceDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        onSubmit={createWorkspace}
        defaultRepoPath={repo.path}
      />
    </div>
  );
}
