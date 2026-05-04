import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Modal } from "../ui/Modal";
import type {
  CommandVariable,
  CommandVariableScope,
  Project,
  ProjectCommand,
} from "../../types";
import { useCommandsStore } from "../../stores/useCommandsStore";

interface Props {
  open: boolean;
  onClose: () => void;
  project: Project;
}

interface DraftCommand {
  id?: string;
  name: string;
  description: string;
  shellTemplate: string;
  cwdRelative: string;
  variables: CommandVariable[];
  isAgentRunnable: boolean;
}

const EMPTY_DRAFT: DraftCommand = {
  name: "",
  description: "",
  shellTemplate: "",
  cwdRelative: "",
  variables: [],
  isAgentRunnable: true,
};

function fromCommand(cmd: ProjectCommand): DraftCommand {
  return {
    id: cmd.id,
    name: cmd.name,
    description: cmd.description ?? "",
    shellTemplate: cmd.shellTemplate,
    cwdRelative: cmd.cwdRelative ?? "",
    variables: cmd.variables ?? [],
    isAgentRunnable: cmd.isAgentRunnable,
  };
}

function detectPlaceholders(template: string): string[] {
  const out: string[] = [];
  const re = /\$\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

export function CommandsEditor({ open, onClose, project }: Props) {
  const commands = useCommandsStore((s) => s.forProject(project.id));
  const load = useCommandsStore((s) => s.load);
  const upsert = useCommandsStore((s) => s.upsert);
  const remove = useCommandsStore((s) => s.remove);

  const [draft, setDraft] = useState<DraftCommand | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) void load(project.id);
  }, [open, project.id, load]);

  useEffect(() => {
    if (!open) {
      setDraft(null);
      setError(null);
    }
  }, [open]);

  const undeclared = useMemo(() => {
    if (!draft) return [];
    const detected = detectPlaceholders(draft.shellTemplate);
    const declared = new Set(draft.variables.map((v) => v.name));
    return detected.filter((d) => !declared.has(d));
  }, [draft]);

  const updateDraft = <K extends keyof DraftCommand>(
    key: K,
    value: DraftCommand[K]
  ) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  };

  const addVariable = () => {
    setDraft((d) =>
      d
        ? {
            ...d,
            variables: [
              ...d.variables,
              {
                name: undeclared[0] ?? "",
                description: "",
                scope: "conversation" as CommandVariableScope,
              },
            ],
          }
        : d
    );
  };

  const removeVariable = (idx: number) => {
    setDraft((d) =>
      d
        ? { ...d, variables: d.variables.filter((_, i) => i !== idx) }
        : d
    );
  };

  const updateVariable = (idx: number, patch: Partial<CommandVariable>) => {
    setDraft((d) =>
      d
        ? {
            ...d,
            variables: d.variables.map((v, i) =>
              i === idx ? { ...v, ...patch } : v
            ),
          }
        : d
    );
  };

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.name.trim() || !draft.shellTemplate.trim()) {
      setError("Name and command template are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await upsert({
        id: draft.id,
        projectId: project.id,
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        shellTemplate: draft.shellTemplate,
        cwdRelative: draft.cwdRelative.trim() || undefined,
        variables: draft.variables.filter((v) => v.name.trim()),
        isAgentRunnable: draft.isAgentRunnable,
      });
      setDraft(null);
    } catch (err) {
      setError(typeof err === "string" ? err : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (cmd: ProjectCommand) => {
    if (!window.confirm(`Delete command "${cmd.name}"?`)) return;
    try {
      await remove(project.id, cmd.id);
    } catch (err) {
      console.error("Delete command failed", err);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Commands · ${project.name}`}
      size="lg"
    >
      {!draft ? (
        <div className="flex flex-col gap-2 text-sm">
          {commands.length === 0 ? (
            <div className="text-zinc-500 text-xs py-4 text-center">
              No commands yet. Define commands like <span className="text-zinc-300">build</span>,{" "}
              <span className="text-zinc-300">run</span>, <span className="text-zinc-300">test</span>{" "}
              with <code>{"${{VARIABLE}}"}</code> placeholders.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {commands.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start gap-2 px-2 py-1.5 rounded border border-zinc-800 bg-zinc-900/60"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-zinc-100 font-medium">{c.name}</div>
                    {c.description && (
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        {c.description}
                      </div>
                    )}
                    <div className="text-[11px] text-zinc-400 font-mono mt-1 truncate">
                      {c.shellTemplate}
                    </div>
                  </div>
                  <button
                    onClick={() => setDraft(fromCommand(c))}
                    className="p-1 text-zinc-500 hover:text-zinc-100"
                    title="Edit"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    className="p-1 text-zinc-500 hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setDraft({ ...EMPTY_DRAFT })}
            className="self-start mt-2 inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-200"
          >
            <Plus size={12} />
            Add command
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 text-sm">
          <div>
            <label className="text-zinc-400 mb-1 text-xs uppercase tracking-wider block">
              Name
            </label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => updateDraft("name", e.target.value)}
              placeholder="build, run, logs, test…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-100 text-sm"
            />
          </div>

          <div>
            <label className="text-zinc-400 mb-1 text-xs uppercase tracking-wider block">
              Description <span className="text-zinc-600">(optional)</span>
            </label>
            <input
              type="text"
              value={draft.description}
              onChange={(e) => updateDraft("description", e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-100 text-sm"
            />
          </div>

          <div>
            <label className="text-zinc-400 mb-1 text-xs uppercase tracking-wider block">
              Shell template
            </label>
            <textarea
              value={draft.shellTemplate}
              onChange={(e) => updateDraft("shellTemplate", e.target.value)}
              rows={3}
              spellCheck={false}
              placeholder={"pnpm dev --port ${{PORT}}"}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-100 text-xs font-mono"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Use <code>{"${{NAME}}"}</code> placeholders. The agent (or you)
              fills them in at run time.
            </p>
          </div>

          <div>
            <label className="text-zinc-400 mb-1 text-xs uppercase tracking-wider block">
              Working subdirectory <span className="text-zinc-600">(relative to checkout)</span>
            </label>
            <input
              type="text"
              value={draft.cwdRelative}
              onChange={(e) => updateDraft("cwdRelative", e.target.value)}
              placeholder="apps/web"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-100 text-xs font-mono"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-zinc-400 text-xs uppercase tracking-wider">
                Variables
              </span>
              <button
                onClick={addVariable}
                className="text-[11px] text-indigo-400 hover:text-indigo-200 inline-flex items-center gap-1"
              >
                <Plus size={11} />
                Add
              </button>
            </div>
            {draft.variables.length === 0 && (
              <div className="text-[11px] text-zinc-500 italic">
                No variables defined.
              </div>
            )}
            {draft.variables.map((v, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1fr_2fr_auto] gap-1.5 mb-1.5"
              >
                <input
                  type="text"
                  value={v.name}
                  onChange={(e) => updateVariable(idx, { name: e.target.value })}
                  placeholder="PORT"
                  className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs font-mono text-zinc-100"
                />
                <input
                  type="text"
                  value={v.description}
                  onChange={(e) =>
                    updateVariable(idx, { description: e.target.value })
                  }
                  placeholder="pick a free port between 3000 and 4000"
                  className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100"
                />
                <button
                  onClick={() => removeVariable(idx)}
                  className="p-1 text-zinc-500 hover:text-red-400"
                  title="Remove"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {undeclared.length > 0 && (
              <div className="text-[11px] text-amber-400 mt-1">
                Template references undeclared variables: {undeclared.join(", ")}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={draft.isAgentRunnable}
              onChange={(e) =>
                updateDraft("isAgentRunnable", e.target.checked)
              }
              className="accent-indigo-500"
            />
            Allow the agent to invoke this command via MCP
          </label>

          {error && (
            <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded px-2 py-1.5">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <button
              onClick={() => setDraft(null)}
              className="px-3 py-1.5 text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={busy}
              className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white rounded font-medium"
            >
              {busy ? "Saving…" : draft.id ? "Save" : "Create"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
