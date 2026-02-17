import type { Settings, ProviderConfig } from "../../types";
import { Toggle } from "../ui/Toggle";

interface ProviderSettingsProps {
  draft: Settings;
  onChange: (partial: Partial<Settings>) => void;
}

export function ProviderSettings({ draft, onChange }: ProviderSettingsProps) {
  const providers = draft.providers ?? [];

  const updateProvider = (
    id: string,
    updates: Partial<ProviderConfig>
  ) => {
    onChange({
      providers: providers.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100 mb-1">
          AI Providers
        </h3>
        <p className="text-xs text-zinc-500">
          Configure API keys for AI agents. Keys are injected as environment
          variables into agent sessions.
        </p>
      </div>

      <div className="space-y-3">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className="border border-zinc-800 rounded-lg p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-200">
                  {provider.name}
                </span>
                <span className="text-[10px] text-zinc-600 font-mono">
                  {provider.envVarName}
                </span>
              </div>
              <Toggle
                label=""
                checked={provider.enabled}
                onChange={(enabled) =>
                  updateProvider(provider.id, { enabled })
                }
              />
            </div>

            {provider.enabled && (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={provider.apiKey}
                    onChange={(e) =>
                      updateProvider(provider.id, {
                        apiKey: e.target.value,
                      })
                    }
                    placeholder={`Enter ${provider.envVarName}...`}
                    className="w-full h-8 px-3 text-sm rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Custom Base URL{" "}
                    <span className="text-zinc-600">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={provider.baseUrl}
                    onChange={(e) =>
                      updateProvider(provider.id, {
                        baseUrl: e.target.value,
                      })
                    }
                    placeholder="https://api.example.com/v1"
                    className="w-full h-8 px-3 text-sm rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
