import { useState, useCallback } from "react";
import type { Settings } from "../../types";
import { useAppStore } from "../../stores/useAppStore";
import { saveSettings } from "../../lib/tauri";
import { Modal } from "../ui/Modal";
import { GeneralSettings } from "./GeneralSettings";
import { AgentSettings } from "./AgentSettings";
import { ProviderSettings } from "./ProviderSettings";

type Section = "general" | "agents" | "providers";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const [section, setSection] = useState<Section>("general");
  const [draft, setDraft] = useState<Settings>(settings);

  // Reset draft when modal opens
  const handleOpen = useCallback(() => {
    setDraft(settings);
    setSection("general");
  }, [settings]);

  // Reset draft when settings change externally and modal opens
  if (open && draft === null) {
    handleOpen();
  }

  const updateDraft = (partial: Partial<Settings>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  };

  const handleSave = async () => {
    setSettings(draft);
    try {
      await saveSettings(draft);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
    onClose();
  };

  const handleCancel = () => {
    setDraft(settings);
    onClose();
  };

  const navItems: { id: Section; label: string }[] = [
    { id: "general", label: "General" },
    { id: "agents", label: "Agent Parameters" },
    { id: "providers", label: "AI Providers" },
  ];

  return (
    <Modal open={open} onClose={handleCancel} title="Settings" size="lg">
      <div className="flex gap-6 min-h-[340px]">
        <nav className="w-40 shrink-0 space-y-0.5">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                section === item.id
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 min-w-0">
          {section === "general" && (
            <GeneralSettings draft={draft} onChange={updateDraft} />
          )}
          {section === "agents" && (
            <AgentSettings draft={draft} onChange={updateDraft} />
          )}
          {section === "providers" && (
            <ProviderSettings draft={draft} onChange={updateDraft} />
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-zinc-700">
        <button
          onClick={handleCancel}
          className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 rounded hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
