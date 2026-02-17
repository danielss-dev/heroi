import type { Settings } from "../../types";
import { useAppStore } from "../../stores/useAppStore";
import { IDE_OPTIONS, SHELL_OPTIONS } from "../../lib/constants";

interface GeneralSettingsProps {
  draft: Settings;
  onChange: (partial: Partial<Settings>) => void;
}

export function GeneralSettings({ draft, onChange }: GeneralSettingsProps) {
  const agents = useAppStore((s) => s.agents);

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
          Default Agent
        </label>
        <select
          value={draft.defaultAgentId}
          onChange={(e) => onChange({ defaultAgentId: e.target.value })}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
        >
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
          Default IDE
        </label>
        <select
          value={draft.defaultIde}
          onChange={(e) => onChange({ defaultIde: e.target.value as Settings["defaultIde"] })}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
        >
          {IDE_OPTIONS.map((ide) => (
            <option key={ide.id} value={ide.id}>
              {ide.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
          Default Shell
        </label>
        <select
          value={draft.defaultShell}
          onChange={(e) => onChange({ defaultShell: e.target.value as Settings["defaultShell"] })}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
        >
          {SHELL_OPTIONS.map((shell) => (
            <option key={shell.id} value={shell.id}>
              {shell.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-zinc-500 mt-1">
          Shell used for terminal tabs and running agents
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
          Git Poll Interval (ms)
        </label>
        <input
          type="number"
          min={1000}
          max={60000}
          step={1000}
          value={draft.gitPollInterval}
          onChange={(e) => onChange({ gitPollInterval: Number(e.target.value) })}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
        />
        <p className="text-xs text-zinc-500 mt-1">
          How often to check for git changes (1000-60000)
        </p>
      </div>
    </div>
  );
}
