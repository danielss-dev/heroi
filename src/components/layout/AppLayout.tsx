import { useCallback, useRef, useEffect } from "react";
import { RepoSidebar } from "../sidebar/RepoSidebar";
import { TopBar } from "./TopBar";
import { TerminalPanel } from "../terminal/TerminalPanel";
import { GitSidebar } from "../git/GitSidebar";
import { useAppStore } from "../../stores/useAppStore";

export function AppLayout() {
  const {
    leftPanelWidth,
    rightPanelWidth,
    setLeftPanelWidth,
    setRightPanelWidth,
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
        const w = Math.max(200, Math.min(500, rect.right - e.clientX));
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

      {/* Center Panel */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <TopBar />
        <TerminalPanel />
      </div>

      {/* Right Resize Handle */}
      <div
        className="w-[3px] shrink-0 cursor-col-resize bg-transparent hover:bg-indigo-500/50 transition-colors"
        onMouseDown={handleMouseDown("right")}
      />

      {/* Right Panel */}
      <div style={{ width: rightPanelWidth }} className="shrink-0 h-full">
        <GitSidebar />
      </div>
    </div>
  );
}
