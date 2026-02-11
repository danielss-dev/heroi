import { FolderGit2 } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { RepoList } from "./RepoList";
import { AddRepoButton } from "./AddRepoButton";

export function RepoSidebar() {
  const { repos } = useAppStore();

  return (
    <div className="flex flex-col h-full bg-[var(--color-panel-bg)] border-r border-[var(--color-panel-border)]">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--color-panel-border)]">
        <FolderGit2 size={14} className="text-zinc-500" />
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Repositories
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        <RepoList repos={repos} />
      </div>

      <div className="border-t border-[var(--color-panel-border)] p-1.5">
        <AddRepoButton />
      </div>
    </div>
  );
}
