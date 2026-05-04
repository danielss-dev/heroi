import { useEffect, useMemo, useState } from "react";
import { Play } from "lucide-react";
import { Modal } from "../ui/Modal";
import type { Conversation, ProjectCommand } from "../../types";
import { useCommandsStore } from "../../stores/useCommandsStore";
import { useConversationStore } from "../../stores/useConversationStore";
import { runProjectCommand } from "../../lib/tauri";

interface Props {
  open: boolean;
  onClose: () => void;
  conversation: Conversation;
  command: ProjectCommand;
}

export function RunCommandDialog({
  open,
  onClose,
  conversation,
  command,
}: Props) {
  const advisory = useCommandsStore((s) => s.advisoryFor(conversation.projectId));
  const loadAdvisory = useCommandsStore((s) => s.loadAdvisory);
  const reloadAdvisory = useCommandsStore((s) => s.reloadAdvisory);
  const upsertConversation = useConversationStore((s) => s.upsertConversation);
  const conversations = useConversationStore((s) => s.conversations);

  const cached = conversation.commandVarCache[command.id] ?? {};

  const initial = useMemo(() => {
    const out: Record<string, string> = {};
    for (const v of command.variables) {
      out[v.name] = cached[v.name] ?? v.defaultValue ?? "";
    }
    return out;
  }, [command.id, command.variables, cached]);

  const [values, setValues] = useState<Record<string, string>>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      void loadAdvisory(conversation.projectId);
      setValues(initial);
      setError(null);
    }
  }, [open, conversation.projectId, initial, loadAdvisory]);

  const conversationName = (id: string) =>
    conversations.find((c) => c.id === id)?.name ?? id.slice(0, 6);

  const handleRun = async () => {
    setBusy(true);
    setError(null);
    try {
      await runProjectCommand(conversation.id, command.id, values);
      // Refresh advisory cache + per-conversation cache from backend.
      const fresh = await reloadAdvisory(conversation.projectId);
      void fresh;
      upsertConversation({
        ...conversation,
        commandVarCache: {
          ...conversation.commandVarCache,
          [command.id]: { ...values },
        },
      });
      onClose();
    } catch (err) {
      setError(typeof err === "string" ? err : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Run · ${command.name}`} size="lg">
      <div className="flex flex-col gap-3 text-sm">
        {command.description && (
          <p className="text-xs text-zinc-400">{command.description}</p>
        )}
        <div className="text-[11px] text-zinc-500 font-mono bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 break-all">
          {command.shellTemplate}
        </div>

        {command.variables.length === 0 ? (
          <div className="text-[11px] text-zinc-500 italic">
            No variables — the command will run as-is.
          </div>
        ) : (
          command.variables.map((v) => {
            const value = values[v.name] ?? "";
            const otherUses = advisory.filter(
              (e) =>
                e.variableName === v.name &&
                !e.inUseByConversationIds.includes(conversation.id) &&
                e.inUseByConversationIds.length > 0
            );
            return (
              <div key={v.name}>
                <label className="text-zinc-300 text-xs flex items-baseline gap-2">
                  <span className="font-mono">${`{{${v.name}}}`}</span>
                  {v.description && (
                    <span className="text-[11px] text-zinc-500 font-sans">
                      — {v.description}
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) =>
                    setValues((s) => ({ ...s, [v.name]: e.target.value }))
                  }
                  spellCheck={false}
                  className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-100 text-sm font-mono"
                />
                {otherUses.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {otherUses.map((e) => (
                      <span
                        key={`${e.variableName}-${e.lastValue}`}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 border border-amber-900 text-amber-300"
                        title={`Last used ${e.lastUsedAt}`}
                      >
                        {e.lastValue} — in use by{" "}
                        {e.inUseByConversationIds
                          .map(conversationName)
                          .join(", ")}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}

        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded px-2 py-1.5">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleRun}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white rounded font-medium"
          >
            <Play size={12} />
            {busy ? "Running…" : "Run in conversation"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
