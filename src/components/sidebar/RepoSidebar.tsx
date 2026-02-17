import { useState } from "react";
import { FolderGit2, Settings } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { RepoList } from "./RepoList";
import { AddRepoButton } from "./AddRepoButton";
import { SettingsModal } from "../settings/SettingsModal";
import { WorkspaceSelector } from "../workspace/WorkspaceSelector";

export function RepoSidebar() {
  const { repos, workspaces, activeWorkspaceId } = useAppStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Filter repos by active workspace if workspaces exist
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const filteredRepos =
    activeWorkspace && activeWorkspace.repoPaths.length > 0
      ? repos.filter((r) => activeWorkspace.repoPaths.includes(r.path))
      : repos;

  return (
    <div className="flex flex-col h-full bg-[var(--color-panel-bg)] border-r border-[var(--color-panel-border)]">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--color-panel-border)]">
        <FolderGit2 size={14} className="text-zinc-500" />
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Repositories
        </span>
      </div>

      <WorkspaceSelector />

      <div className="flex-1 overflow-y-auto py-1">
        <RepoList repos={filteredRepos} />
      </div>

      <div className="flex items-center gap-1 border-t border-[var(--color-panel-border)] p-1.5">
        <AddRepoButton />
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          title="Settings"
        >
          <Settings size={16} />
        </button>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
