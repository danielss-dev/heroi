import { useState, useRef, useEffect } from "react";
import { X, Plus, Bot, Terminal as TerminalIcon } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { destroySession, getSessionStatus } from "./XtermTerminal";

function agentIcon(agentId: string, isActive: boolean) {
  const className = isActive ? "text-zinc-300" : "text-zinc-500";
  if (agentId === "shell") return <TerminalIcon size={12} className={className} />;
  return <Bot size={12} className={className} />;
}

export function AgentTabBar() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const selectedWorktree = useAppStore((s) => s.selectedWorktree);
  const agents = useAppStore((s) => s.agents);
  const worktreeTabs = useAppStore((s) => s.worktreeTabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const addTab = useAppStore((s) => s.addTab);
  const removeTab = useAppStore((s) => s.removeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!selectedWorktree) return null;

  const worktreePath = selectedWorktree.path;
  const tabs = worktreeTabs[worktreePath] ?? [];
  const currentActiveTabId = activeTabId[worktreePath];

  const handleAddTab = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;
    addTab(worktreePath, agentId, agent.name);
    setPickerOpen(false);
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    destroySession(tabId);
    removeTab(worktreePath, tabId);

    // If that was the last tab, auto-create a new Shell tab
    const remainingTabs = (worktreeTabs[worktreePath] ?? []).filter(
      (t) => t.id !== tabId
    );
    if (remainingTabs.length === 0) {
      const shellAgent = agents.find((a) => a.id === "shell");
      if (shellAgent) {
        addTab(worktreePath, "shell", "Shell");
      }
    }
  };

  return (
    <div className="flex items-center bg-zinc-950 border-b border-zinc-800/80 pl-1 pr-1.5 h-[36px] gap-0.5">
      {/* Scrollable tab strip */}
      <div className="flex items-center gap-[3px] flex-1 overflow-x-auto scrollbar-none py-[5px]">
        {tabs.map((tab) => {
          const isActive = tab.id === currentActiveTabId;
          const sessionStatus = getSessionStatus(tab.id);
          const isRunning = sessionStatus === "running";

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(worktreePath, tab.id)}
              className={`group flex items-center gap-1.5 pl-2.5 pr-1.5 h-[26px] text-[11px] font-medium rounded-md transition-all duration-150 whitespace-nowrap select-none ${
                isActive
                  ? "bg-zinc-800 text-zinc-200 shadow-sm shadow-black/20"
                  : "text-zinc-500 hover:text-zinc-400 hover:bg-zinc-800/40"
              }`}
            >
              {/* Status indicator / icon */}
              {isRunning ? (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              ) : (
                agentIcon(tab.agentId, isActive)
              )}

              {/* Label */}
              <span className="leading-none">{tab.label}</span>

              {/* Close button - always visible on active, hover-reveal on inactive */}
              <span
                onClick={(e) => handleCloseTab(e, tab.id)}
                className={`ml-0.5 p-[3px] rounded transition-all duration-100 ${
                  isActive
                    ? "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700"
                    : "opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                <X size={10} strokeWidth={2.5} />
              </span>
            </button>
          );
        })}
      </div>

      {/* Add tab button */}
      <div ref={pickerRef} className="relative shrink-0">
        <button
          onClick={() => setPickerOpen(!pickerOpen)}
          className="flex items-center justify-center w-[24px] h-[24px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-md transition-colors"
          title="New tab"
        >
          <Plus size={14} strokeWidth={2} />
        </button>
        {pickerOpen && (
          <div className="absolute top-full right-0 mt-1.5 z-50 min-w-[170px] bg-zinc-900 border border-zinc-700/80 rounded-lg shadow-xl shadow-black/30 py-1 overflow-hidden">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => handleAddTab(agent.id)}
                className="flex items-center gap-2.5 w-full px-3 py-1.5 text-[12px] text-left text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                {agent.id === "shell" ? (
                  <TerminalIcon size={12} className="text-zinc-500" />
                ) : (
                  <Bot size={12} className="text-zinc-500" />
                )}
                {agent.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
