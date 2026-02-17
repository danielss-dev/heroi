import { useCallback, useRef, useEffect } from "react";
import {
  GitCommitHorizontal,
  GitCompareArrows,
  FolderOpen,
  ScrollText,
} from "lucide-react";
import { RepoSidebar } from "../sidebar/RepoSidebar";
import { TopBar } from "./TopBar";
import { TerminalPanel } from "../terminal/TerminalPanel";
import { GitSidebar } from "../git/GitSidebar";
import { DiffViewer } from "../diff/DiffViewer";
import { RunPanel } from "../scripts/RunPanel";
import { FileBrowser } from "../files/FileBrowser";
import { useAppStore } from "../../stores/useAppStore";
import type { RightPanel } from "../../stores/useAppStore";

const RIGHT_TABS: {
  id: RightPanel;
  label: string;
  icon: typeof GitCommitHorizontal;
}[] = [
  { id: "git", label: "Git", icon: GitCommitHorizontal },
  { id: "diff", label: "Changes", icon: GitCompareArrows },
  { id: "files", label: "Files", icon: FolderOpen },
  { id: "scripts", label: "Scripts", icon: ScrollText },
];

export function AppLayout() {
  const {
    leftPanelWidth,
    rightPanelWidth,
    rightPanel,
    setLeftPanelWidth,
    setRightPanelWidth,
    setRightPanel,
  } = useAppStore();

  const draggingRef = useRef<"left" | "right" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (side: "left" | "right") => (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = side;
    },
    []
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      if (draggingRef.current === "left") {
        const w = Math.max(180, Math.min(400, e.clientX - rect.left));
        setLeftPanelWidth(w);
      } else {
        const w = Math.max(200, Math.min(600, rect.right - e.clientX));
        setRightPanelWidth(w);
      }
    };

    const handleMouseUp = () => {
      draggingRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [setLeftPanelWidth, setRightPanelWidth]);

  return (
    <div ref={containerRef} className="flex h-screen w-screen overflow-hidden">
      {/* Left Panel */}
      <div style={{ width: leftPanelWidth }} className="shrink-0 h-full">
        <RepoSidebar />
      </div>

      {/* Left Resize Handle */}
      <div
        className="w-[3px] shrink-0 cursor-col-resize bg-transparent hover:bg-indigo-500/50 transition-colors"
        onMouseDown={handleMouseDown("left")}
      />

      {/* Center Panel — Terminal only */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <TopBar />
        <div className="flex-1 min-h-0 flex flex-col">
          <TerminalPanel />
        </div>
      </div>

      {/* Right Resize Handle */}
      <div
        className="w-[3px] shrink-0 cursor-col-resize bg-transparent hover:bg-indigo-500/50 transition-colors"
        onMouseDown={handleMouseDown("right")}
      />

      {/* Right Panel */}
      <div
        style={{ width: rightPanelWidth }}
        className="shrink-0 h-full flex flex-col bg-[var(--color-panel-bg)] border-l border-[var(--color-panel-border)]"
      >
        {/* Right Panel Tabs */}
        <div className="flex items-center gap-0 border-b border-[var(--color-panel-border)] shrink-0">
          {RIGHT_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setRightPanel(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors border-b-2 ${
                rightPanel === id
                  ? "text-zinc-100 border-indigo-500"
                  : "text-zinc-500 border-transparent hover:text-zinc-300"
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {/* Right Panel Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {rightPanel === "git" && <GitSidebar />}
          {rightPanel === "diff" && <DiffViewer />}
          {rightPanel === "files" && <FileBrowser />}
          {rightPanel === "scripts" && <RunPanel />}
        </div>
      </div>
    </div>
  );
}
