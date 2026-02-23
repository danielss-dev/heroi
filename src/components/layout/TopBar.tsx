import { useState, useRef, useEffect } from "react";
import {
  FolderOpen,
  ChevronDown,
  ScrollText,
  GitCompareArrows,
  Play,
} from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { Button } from "../ui/Button";
import { openInIde } from "../../lib/tauri";
import { useScripts } from "../../hooks/useScripts";
import type { IdeType } from "../../types";

const OPEN_OPTIONS: { id: IdeType; label: string; shortcut?: string }[] = [
  { id: "finder", label: "Finder" },
  { id: "cursor", label: "Cursor" },
  { id: "vscode", label: "VS Code" },
  { id: "zed", label: "Zed" },
];

export function TopBar() {
  const { selectedWorktree, setRightPanel } = useAppStore();
  const { config, hasConfig, executeScript, loading } = useScripts();
  const [showOpenMenu, setShowOpenMenu] = useState(false);
  const [showScriptsMenu, setShowScriptsMenu] = useState(false);
  const openMenuRef = useRef<HTMLDivElement>(null);
  const scriptsMenuRef = useRef<HTMLDivElement>(null);

  const activeWorkspace = useAppStore((s) => {
    const workspaces = s.workspaces;
    return workspaces.find((w) => w.id === s.activeWorkspaceId);
  });

  const handleOpenIde = async (ide: IdeType) => {
    if (!selectedWorktree) return;
    try {
      await openInIde(selectedWorktree.path, ide);
    } catch (err) {
      console.error("Failed to open:", err);
    }
    setShowOpenMenu(false);
  };

  // Close menus on outside click
  useEffect(() => {
    if (!showOpenMenu && !showScriptsMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (
        showOpenMenu &&
        openMenuRef.current &&
        !openMenuRef.current.contains(e.target as Node)
      ) {
        setShowOpenMenu(false);
      }
      if (
        showScriptsMenu &&
        scriptsMenuRef.current &&
        !scriptsMenuRef.current.contains(e.target as Node)
      ) {
        setShowScriptsMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showOpenMenu, showScriptsMenu]);

  const allRunScripts = config?.run ?? [];

  const handleReview = () => {
    const baseBranch = activeWorkspace?.baseBranch ?? "main";
    window.dispatchEvent(
      new CustomEvent("heroi:launch-review", {
        detail: { baseBranch },
      })
    );
  };

  // Truncate the path to show just the last directory name
  const shortPath = selectedWorktree
    ? "/" + selectedWorktree.path.split("/").filter(Boolean).slice(-1)[0]
    : "";

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-panel-bg)] border-b border-[var(--color-panel-border)]">
      {selectedWorktree ? (
        <>
          <FolderOpen size={13} className="text-zinc-500 shrink-0" />
          <span className="text-xs text-zinc-400 truncate font-mono">
            {shortPath}
          </span>

          {/* Open dropdown */}
          <div className="relative" ref={openMenuRef}>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={() => setShowOpenMenu(!showOpenMenu)}
            >
              Open
              <ChevronDown size={10} />
            </Button>

            {showOpenMenu && (
              <div className="absolute left-0 top-full mt-1 z-50 w-44 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl py-1">
                {OPEN_OPTIONS.map(({ id, label, shortcut }, index) => (
                  <button
                    key={id}
                    onClick={() => handleOpenIde(id)}
                    className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 text-[10px] w-3">
                        {index + 1}
                      </span>
                      {label}
                    </div>
                    {shortcut && (
                      <span className="text-[10px] text-zinc-600">
                        {shortcut}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1" />

          {/* Review button */}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={handleReview}
            title="Launch code review agent"
          >
            <GitCompareArrows size={12} />
            Review
          </Button>

          {/* Scripts dropdown */}
          {hasConfig && (
            <div className="relative" ref={scriptsMenuRef}>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() => setShowScriptsMenu(!showScriptsMenu)}
                title="Run scripts"
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
                          <Play
                            size={10}
                            className="text-green-400 shrink-0"
                          />
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
          Select a workspace to begin
        </span>
      )}
    </div>
  );
}
