import { useState } from "react";
import {
  Play,
  Square,
  RefreshCw,
  Circle,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "../ui/Button";
import { useScripts } from "../../hooks/useScripts";
import type { ScriptDef, HeroiConfig } from "../../types";

type ScriptCategory = "setup" | "run" | "archive";

function AddScriptForm({
  onAdd,
}: {
  onAdd: (script: ScriptDef, category: ScriptCategory) => void;
}) {
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [category, setCategory] = useState<ScriptCategory>("run");

  const handleSubmit = () => {
    if (!name.trim() || !command.trim()) return;
    onAdd(
      {
        name: name.trim(),
        command: command.trim(),
        args: args
          .trim()
          .split(/\s+/)
          .filter((a) => a),
      },
      category
    );
    setName("");
    setCommand("");
    setArgs("");
  };

  return (
    <div className="space-y-2 p-2 bg-zinc-800/50 rounded-md">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400">
        Add Script
      </div>
      <input
        type="text"
        placeholder="Name (e.g. dev)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
      />
      <input
        type="text"
        placeholder="Command (e.g. npm)"
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        className="w-full text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
      />
      <input
        type="text"
        placeholder="Args (e.g. run dev)"
        value={args}
        onChange={(e) => setArgs(e.target.value)}
        className="w-full text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
      />
      <div className="flex items-center gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ScriptCategory)}
          className="text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 focus:outline-none focus:border-zinc-500"
        >
          <option value="setup">Setup</option>
          <option value="run">Run</option>
          <option value="archive">Archive</option>
        </select>
        <Button
          variant="default"
          size="sm"
          className="gap-1 ml-auto"
          onClick={handleSubmit}
          disabled={!name.trim() || !command.trim()}
        >
          <Plus size={10} />
          Add
        </Button>
      </div>
    </div>
  );
}

export function RunPanel() {
  const {
    config,
    localConfig,
    processes,
    loading,
    hasConfig,
    hasRepoConfig,
    saveLocalConfig,
    executeScript,
    killProcess,
    refreshProcesses,
  } = useScripts();

  const [showAddForm, setShowAddForm] = useState(false);

  const isLocalOnly = !hasRepoConfig;

  const handleAddLocalScript = (script: ScriptDef, category: ScriptCategory) => {
    const base: HeroiConfig = localConfig ?? {
      setup: [],
      run: [],
      archive: [],
      env: {},
    };
    const updated: HeroiConfig = {
      ...base,
      [category]: [...base[category], script],
    };
    saveLocalConfig(updated);
    setShowAddForm(false);
  };

  const handleDeleteLocalScript = (
    scriptName: string,
    category: ScriptCategory
  ) => {
    if (!localConfig) return;
    const updated: HeroiConfig = {
      ...localConfig,
      [category]: localConfig[category].filter((s) => s.name !== scriptName),
    };
    saveLocalConfig(updated);
  };

  const renderScriptGroup = (
    title: string,
    scripts: ScriptDef[],
    variant: ScriptCategory
  ) => {
    if (scripts.length === 0) return null;

    const colorMap = {
      setup: "text-blue-400",
      run: "text-green-400",
      archive: "text-amber-400",
    };

    return (
      <div className="space-y-1">
        <div
          className={`text-[10px] uppercase tracking-wider font-semibold ${colorMap[variant]}`}
        >
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
                  <Circle size={6} className="text-zinc-600 shrink-0" />
                )}
                <span className="text-xs text-zinc-300 truncate">
                  {script.name}
                </span>
                <span className="text-[10px] text-zinc-600 font-mono truncate hidden group-hover:inline">
                  {script.command} {script.args.join(" ")}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isLocalOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Delete"
                    onClick={() => handleDeleteLocalScript(script.name, variant)}
                    className="opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={10} className="text-zinc-500" />
                  </Button>
                )}
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
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-300">Scripts</span>
          {hasConfig && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
              {hasRepoConfig ? "heroi.json" : "local"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isLocalOnly && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="p-1 text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800 transition-colors"
              title="Add script"
            >
              <Plus size={11} />
            </button>
          )}
          <button
            onClick={refreshProcesses}
            className="p-1 text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4">
        {!hasConfig && !showAddForm && (
          <div className="text-center py-4">
            <p className="text-xs text-zinc-500 mb-2">
              No scripts configured for this workspace.
            </p>
            <p className="text-[11px] text-zinc-600 mb-3">
              Add a <span className="font-mono text-zinc-400">heroi.json</span>{" "}
              to your repo, or add scripts locally.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowAddForm(true)}
            >
              <Plus size={11} />
              Add Script
            </Button>
          </div>
        )}

        {showAddForm && <AddScriptForm onAdd={handleAddLocalScript} />}

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
