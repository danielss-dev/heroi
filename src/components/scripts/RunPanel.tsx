import { Play, Square, RefreshCw, Circle } from "lucide-react";
import { Button } from "../ui/Button";
import { useScripts } from "../../hooks/useScripts";
import type { ScriptDef } from "../../types";

export function RunPanel() {
  const {
    config,
    processes,
    loading,
    hasConfig,
    executeScript,
    killProcess,
    refreshProcesses,
  } = useScripts();

  if (!hasConfig) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-zinc-500 mb-2">
          No <span className="font-mono text-zinc-400">heroi.json</span> found
          in this workspace.
        </p>
        <p className="text-[11px] text-zinc-600">
          Create one to define setup, run, and archive scripts.
        </p>
      </div>
    );
  }

  const renderScriptGroup = (
    title: string,
    scripts: ScriptDef[],
    variant: "setup" | "run" | "archive"
  ) => {
    if (scripts.length === 0) return null;

    const colorMap = {
      setup: "text-blue-400",
      run: "text-green-400",
      archive: "text-amber-400",
    };

    return (
      <div className="space-y-1">
        <div className={`text-[10px] uppercase tracking-wider font-semibold ${colorMap[variant]}`}>
          {title}
        </div>
        {scripts.map((script) => {
          const running = processes.find(
            (p) => p.script_name === script.name && p.status === "Running"
          );
          return (
            <div
              key={script.name}
              className="flex items-center justify-between py-1 px-2 rounded hover:bg-zinc-800/50 group"
            >
              <div className="flex items-center gap-2 min-w-0">
                {running ? (
                  <Circle
                    size={6}
                    className="fill-green-500 text-green-500 shrink-0"
                  />
                ) : (
                  <Circle
                    size={6}
                    className="text-zinc-600 shrink-0"
                  />
                )}
                <span className="text-xs text-zinc-300 truncate">
                  {script.name}
                </span>
                <span className="text-[10px] text-zinc-600 font-mono truncate hidden group-hover:inline">
                  {script.command} {script.args.join(" ")}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {running ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Stop"
                    onClick={() => killProcess(running.id)}
                  >
                    <Square size={10} className="text-red-400" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Run"
                    disabled={loading}
                    onClick={() => executeScript(script)}
                  >
                    <Play size={10} className="text-green-400" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <span className="text-xs font-semibold text-zinc-300">Scripts</span>
        <button
          onClick={refreshProcesses}
          className="p-1 text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={11} />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4">
        {renderScriptGroup("Setup", config?.setup ?? [], "setup")}
        {renderScriptGroup("Run", config?.run ?? [], "run")}
        {renderScriptGroup("Archive", config?.archive ?? [], "archive")}

        {processes.length > 0 && (
          <div className="space-y-1 pt-2 border-t border-zinc-800">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">
              Processes
            </div>
            {processes.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-1 px-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Circle
                    size={6}
                    className={
                      p.status === "Running"
                        ? "fill-green-500 text-green-500"
                        : p.status === "Failed"
                          ? "fill-red-500 text-red-500"
                          : "text-zinc-600"
                    }
                  />
                  <span className="text-zinc-300 truncate">
                    {p.script_name}
                  </span>
                  <span className="text-[10px] text-zinc-600 font-mono">
                    PID {p.pid}
                  </span>
                </div>
                {p.status === "Running" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Stop"
                    onClick={() => killProcess(p.id)}
                  >
                    <Square size={10} className="text-red-400" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
