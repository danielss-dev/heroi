import { useState, useEffect, useCallback, useRef } from "react";
import { StickyNote } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { saveWorkspaceNotes, loadWorkspaceNotes } from "../../lib/tauri";

export function WorkspaceNotes() {
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load notes when workspace changes
  useEffect(() => {
    if (!activeWorkspaceId) {
      setNotes("");
      return;
    }
    loadWorkspaceNotes(activeWorkspaceId)
      .then(setNotes)
      .catch(() => setNotes(""));
  }, [activeWorkspaceId]);

  // Auto-save with debounce
  const debouncedSave = useCallback(
    (value: string) => {
      if (!activeWorkspaceId) return;
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(async () => {
        setSaving(true);
        try {
          await saveWorkspaceNotes(activeWorkspaceId, value);
        } catch (err) {
          console.error("Failed to save notes:", err);
        } finally {
          setSaving(false);
        }
      }, 500);
    },
    [activeWorkspaceId]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNotes(value);
    debouncedSave(value);
  };

  if (!activeWorkspaceId) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <StickyNote size={12} className="text-zinc-500" />
          <span className="text-xs font-semibold text-zinc-300">Notes</span>
        </div>
        {saving && (
          <span className="text-[10px] text-zinc-600">Saving...</span>
        )}
      </div>
      <textarea
        value={notes}
        onChange={handleChange}
        placeholder="Pre-merge checklist, TODOs, reminders..."
        rows={4}
        className="w-full px-2 py-1.5 text-xs rounded bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 resize-none font-mono leading-relaxed"
      />
    </div>
  );
}
