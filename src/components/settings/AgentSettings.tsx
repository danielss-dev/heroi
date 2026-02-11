import { useState } from "react";
import type { Settings, AgentArgsConfig } from "../../types";
import { useAppStore } from "../../stores/useAppStore";
import { AGENT_KNOWN_FLAGS } from "../../lib/constants";
import { Toggle } from "../ui/Toggle";

interface AgentSettingsProps {
  draft: Settings;
  onChange: (partial: Partial<Settings>) => void;
}

function getAgentConfig(draft: Settings, agentId: string): AgentArgsConfig {
  return draft.agentArgs[agentId] ?? { flags: {}, extraArgs: "" };
}

export function AgentSettings({ draft, onChange }: AgentSettingsProps) {
  const agents = useAppStore((s) => s.agents);
  const [activeTab, setActiveTab] = useState(agents[0]?.id ?? "claude");

  const agentFlags = AGENT_KNOWN_FLAGS[activeTab] ?? [];
  const config = getAgentConfig(draft, activeTab);

  const updateConfig = (updated: Partial<AgentArgsConfig>) => {
    onChange({
      agentArgs: {
        ...draft.agentArgs,
        [activeTab]: { ...config, ...updated },
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-zinc-700 pb-0">
        {agents
          .filter((a) => a.id !== "shell")
          .map((agent) => (
            <button
              key={agent.id}
              onClick={() => setActiveTab(agent.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
                activeTab === agent.id
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700 border-b-zinc-900 -mb-px"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {agent.name}
            </button>
          ))}
      </div>

      {agentFlags.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Flags
          </h4>
          {agentFlags.map((flagDef) => (
            <Toggle
              key={flagDef.flag}
              label={flagDef.label}
              description={flagDef.description}
              checked={config.flags[flagDef.flag] ?? false}
              onChange={(checked) =>
                updateConfig({
                  flags: { ...config.flags, [flagDef.flag]: checked },
                })
              }
            />
          ))}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
          Extra Arguments
        </label>
        <input
          type="text"
          value={config.extraArgs}
          onChange={(e) => updateConfig({ extraArgs: e.target.value })}
          placeholder="e.g. --model gpt-4"
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
        />
        <p className="text-xs text-zinc-500 mt-1">
          Space-separated arguments appended to the agent command
        </p>
      </div>
    </div>
  );
}
