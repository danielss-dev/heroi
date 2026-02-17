import { useState, useRef, useEffect } from "react";
import { ChevronDown, Layers, Plus, Trash2, Pencil } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { saveWorkspaces } from "../../lib/tauri";

export function WorkspaceSelector() {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const workspaces = useAppStore((s) => s.workspaces);
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId);
  const createWorkspace = useAppStore((s) => s.createWorkspace);
  const switchWorkspace = useAppStore((s) => s.switchWorkspace);
  const deleteWorkspace = useAppStore((s) => s.deleteWorkspace);
  const renameWorkspace = useAppStore((s) => s.renameWorkspace);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setEditingId(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (creating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [creating]);

  const persistWorkspaces = async () => {
    const state = useAppStore.getState();
    try {
      await saveWorkspaces(state.workspaces, state.activeWorkspaceId);
    } catch (err) {
      console.error("Failed to persist workspaces:", err);
    }
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    createWorkspace(newName.trim());
    setNewName("");
    setCreating(false);
    setOpen(false);
    persistWorkspaces();
  };

  const handleSwitch = (id: string) => {
    if (id === activeWorkspaceId) return;
    switchWorkspace(id);
    setOpen(false);
    persistWorkspaces();
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (workspaces.length <= 1) return;
    deleteWorkspace(id);
    persistWorkspaces();
  };

  const handleStartRename = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setEditingId(id);
    setEditName(name);
  };

  const handleRename = () => {
    if (!editingId || !editName.trim()) return;
    renameWorkspace(editingId, editName.trim());
    setEditingId(null);
    persistWorkspaces();
  };

  return (
    <div ref={ref} className="relative px-2 py-1.5 border-b border-[var(--color-panel-border)]">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-2 py-1 text-xs rounded-md hover:bg-zinc-800 transition-colors"
      >
        <Layers size={12} className="text-indigo-400 shrink-0" />
        <span className="text-zinc-300 truncate flex-1 text-left">
          {activeWorkspace?.name ?? "No workspace"}
        </span>
        <ChevronDown
          size={12}
          className={`text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-2 right-2 top-full mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl py-1">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              onClick={() => handleSwitch(ws.id)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                ws.id === activeWorkspaceId
                  ? "text-indigo-400 bg-zinc-800"
                  : "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
              }`}
            >
              {editingId === ws.id ? (
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onBlur={handleRename}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-1.5 py-0.5 text-xs text-zinc-200 outline-none focus:border-indigo-500/50"
                  autoFocus
                />
              ) : (
                <>
                  <Layers size={11} className="shrink-0" />
                  <span className="flex-1 truncate">{ws.name}</span>
                  <button
                    onClick={(e) => handleStartRename(e, ws.id, ws.name)}
                    className="p-0.5 text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100"
                    title="Rename"
                  >
                    <Pencil size={10} />
                  </button>
                  {workspaces.length > 1 && (
                    <button
                      onClick={(e) => handleDelete(e, ws.id)}
                      className="p-0.5 text-zinc-500 hover:text-red-400"
                      title="Delete workspace"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}

          <div className="border-t border-zinc-700 mt-1 pt-1">
            {creating ? (
              <div className="px-3 py-1">
                <input
                  ref={inputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") {
                      setCreating(false);
                      setNewName("");
                    }
                  }}
                  placeholder="Workspace name..."
                  className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-500/50"
                />
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                <Plus size={11} />
                New Workspace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
