import { FolderOpen, Code2, MousePointer, Zap, Play } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { AgentSelector } from "../terminal/AgentSelector";
import { Button } from "../ui/Button";
import { openInIde } from "../../lib/tauri";
import type { IdeType } from "../../types";

const IDE_BUTTONS: { id: IdeType; label: string; icon: typeof Code2 }[] = [
  { id: "vscode", label: "VS Code", icon: Code2 },
  { id: "cursor", label: "Cursor", icon: MousePointer },
  { id: "zed", label: "Zed", icon: Zap },
];

export function TopBar() {
  const { selectedWorktree } = useAppStore();

  const handleOpenIde = async (ide: IdeType) => {
    if (!selectedWorktree) return;
    try {
      await openInIde(selectedWorktree.path, ide);
    } catch (err) {
      console.error("Failed to open IDE:", err);
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-panel-bg)] border-b border-[var(--color-panel-border)]">
      {selectedWorktree ? (
        <>
          <FolderOpen size={13} className="text-zinc-500 shrink-0" />
          <span className="text-xs text-zinc-400 truncate flex-1 font-mono">
            {selectedWorktree.path}
          </span>

          <div className="flex items-center gap-1 shrink-0">
            {IDE_BUTTONS.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant="ghost"
                size="icon"
                title={`Open in ${label}`}
                onClick={() => handleOpenIde(id)}
              >
                <Icon size={13} />
              </Button>
            ))}
          </div>

          <div className="w-px h-4 bg-zinc-700 mx-1" />

          <AgentSelector />

          <Button
            variant="default"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              // Force re-spawn by dispatching a custom event
              window.dispatchEvent(new CustomEvent("heroi:respawn-agent"));
            }}
          >
            <Play size={11} />
            Run
          </Button>
        </>
      ) : (
        <span className="text-xs text-zinc-500">
          Select a worktree to begin
        </span>
      )}
    </div>
  );
}
