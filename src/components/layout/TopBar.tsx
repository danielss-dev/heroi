import { useState, useRef, useEffect } from "react";
import {
  FolderOpen,
  Code2,
  MousePointer,
  Zap,
  Play,
  ChevronDown,
  ScrollText,
} from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { Button } from "../ui/Button";
import { openInIde } from "../../lib/tauri";
import { useScripts } from "../../hooks/useScripts";
import type { IdeType } from "../../types";

const IDE_BUTTONS: { id: IdeType; label: string; icon: typeof Code2 }[] = [
  { id: "vscode", label: "VS Code", icon: Code2 },
  { id: "cursor", label: "Cursor", icon: MousePointer },
  { id: "zed", label: "Zed", icon: Zap },
];

export function TopBar() {
  const { selectedWorktree, setRightPanel } = useAppStore();
  const { config, hasConfig, executeScript, loading } = useScripts();
  const [showScriptsMenu, setShowScriptsMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleOpenIde = async (ide: IdeType) => {
    if (!selectedWorktree) return;
    try {
      await openInIde(selectedWorktree.path, ide);
    } catch (err) {
      console.error("Failed to open IDE:", err);
    }
  };

  // Close menu on outside click
  useEffect(() => {
    if (!showScriptsMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowScriptsMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showScriptsMenu]);

  const allRunScripts = config?.run ?? [];

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

          {/* Run agent button */}
          <Button
            variant="default"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("heroi:respawn-agent"));
            }}
          >
            <Play size={11} />
            Run
          </Button>

          {/* Scripts dropdown */}
          {hasConfig && (
            <div className="relative" ref={menuRef}>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() => setShowScriptsMenu(!showScriptsMenu)}
                title="Run scripts from heroi.json"
              >
                <ScrollText size={12} />
                <ChevronDown size={10} />
              </Button>

              {showScriptsMenu && (
                <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl py-1">
                  {allRunScripts.length > 0 && (
                    <>
                      <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">
                        Run Scripts
                      </div>
                      {allRunScripts.map((s) => (
                        <button
                          key={s.name}
                          disabled={loading}
                          onClick={() => {
                            executeScript(s);
                            setShowScriptsMenu(false);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-2"
                        >
                          <Play size={10} className="text-green-400 shrink-0" />
                          {s.name}
                        </button>
                      ))}
                    </>
                  )}

                  <div className="border-t border-zinc-800 mt-1 pt-1">
                    <button
                      onClick={() => {
                        setRightPanel("scripts");
                        setShowScriptsMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 transition-colors"
                    >
                      View all scripts...
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <span className="text-xs text-zinc-500">
          Select a worktree to begin
        </span>
      )}
    </div>
  );
}
