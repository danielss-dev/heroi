import { useState, useRef, useEffect } from "react";
import { X, Plus, Bot, Terminal as TerminalIcon } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { destroySession } from "./XtermTerminal";

function agentIcon(agentId: string) {
  if (agentId === "shell") return <TerminalIcon size={11} />;
  return <Bot size={11} />;
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
  };

  return (
    <div className="flex items-center bg-[#0c0c0e] border-b border-zinc-800 px-1 min-h-[32px]">
      <div className="flex items-center gap-0.5 flex-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === currentActiveTabId;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(worktreePath, tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-t-md transition-colors whitespace-nowrap ${
                isActive
                  ? "bg-[#09090b] text-zinc-200 border-t-2 border-indigo-500"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              }`}
            >
              {agentIcon(tab.agentId)}
              <span>{tab.label}</span>
              {tabs.length > 1 && (
                <span
                  onClick={(e) => handleCloseTab(e, tab.id)}
                  className="ml-1 p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300"
                >
                  <X size={10} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div ref={pickerRef} className="relative shrink-0 ml-1">
        <button
          onClick={() => setPickerOpen(!pickerOpen)}
          className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
          title="Add agent tab"
        >
          <Plus size={13} />
        </button>
        {pickerOpen && (
          <div className="absolute top-full right-0 mt-1 z-50 min-w-[160px] bg-zinc-900 border border-zinc-700 rounded-md shadow-xl py-1">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => handleAddTab(agent.id)}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                {agentIcon(agent.id)}
                {agent.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
