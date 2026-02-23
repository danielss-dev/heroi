import { useState } from "react";
import { Settings, Workflow } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { useWorkflowStore } from "../../stores/useWorkflowStore";
import { RepoList } from "./RepoList";
import { AddRepoButton } from "./AddRepoButton";
import { SettingsModal } from "../settings/SettingsModal";
import heroiLogo from "/heroilogo.png";

export function RepoSidebar() {
  const repos = useAppStore((s) => s.repos);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex flex-col h-full bg-[var(--color-panel-bg)] border-r border-[var(--color-panel-border)]">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--color-panel-border)]">
        <img src={heroiLogo} alt="Heroi" className="w-4 h-4" />
        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Heroi
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        <RepoList repos={repos} />
      </div>

      <div className="flex items-center gap-1 border-t border-[var(--color-panel-border)] p-1.5">
        <AddRepoButton />
        <button
          onClick={() => {
            useWorkflowStore.getState().setShowWorkflowView(true);
          }}
          className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          title="Workflows"
        >
          <Workflow size={16} />
        </button>
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
