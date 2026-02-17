import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  Layers,
  Plus,
  Trash2,
  Pencil,
  GitBranch,
  Archive,
  RotateCcw,
} from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import {
  saveWorkspaces,
  createWorkspaceWithWorktree,
  deleteWorkspaceWithWorktree,
  archiveWorkspace as archiveWsBackend,
  restoreWorkspace as restoreWsBackend,
} from "../../lib/tauri";
import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog";
import { WorkspaceStatusBadge } from "./WorkspaceStatusBadge";

export function WorkspaceSelector() {
  const [open, setOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const workspaces = useAppStore((s) => s.workspaces);
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId);
  const addWorkspaceFromConfig = useAppStore((s) => s.addWorkspaceFromConfig);
  const switchWorkspace = useAppStore((s) => s.switchWorkspace);
  const deleteWorkspace = useAppStore((s) => s.deleteWorkspace);
  const renameWorkspace = useAppStore((s) => s.renameWorkspace);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const activeWorkspaces = workspaces.filter((w) => w.status === "active");
  const archivedWorkspaces = workspaces.filter((w) => w.status === "archived");

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setEditingId(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const persistWorkspaces = async () => {
    const state = useAppStore.getState();
    try {
      await saveWorkspaces(state.workspaces, state.activeWorkspaceId);
    } catch (err) {
      console.error("Failed to persist workspaces:", err);
    }
  };

  const handleCreateWorkspace = async (
    repoPath: string,
    name: string,
    branch?: string,
    baseBranch?: string
  ) => {
    const config = await createWorkspaceWithWorktree(
      repoPath,
      name,
      branch,
      baseBranch
    );
    const workspace = addWorkspaceFromConfig(config);
    useAppStore.getState().loadWorkspaceState(workspace);
    await persistWorkspaces();
  };

  const handleSwitch = (id: string) => {
    if (id === activeWorkspaceId) return;
    switchWorkspace(id);
    setOpen(false);
    persistWorkspaces();
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (workspaces.length <= 1) return;

    try {
      await deleteWorkspaceWithWorktree(id);
    } catch (err) {
      console.error("Failed to delete worktree:", err);
    }

    deleteWorkspace(id);
    persistWorkspaces();
  };

  const handleArchive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await archiveWsBackend(id);
      // Update frontend state
      useAppStore.setState((s) => ({
        workspaces: s.workspaces.map((w) =>
          w.id === id ? { ...w, status: "archived" as const } : w
        ),
      }));
      await persistWorkspaces();
    } catch (err) {
      console.error("Failed to archive:", err);
    }
  };

  const handleRestore = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await restoreWsBackend(id);
      useAppStore.setState((s) => ({
        workspaces: s.workspaces.map((w) =>
          w.id === id ? { ...w, status: "active" as const } : w
        ),
      }));
      await persistWorkspaces();
    } catch (err) {
      console.error("Failed to restore:", err);
    }
  };

  const handleStartRename = (
    e: React.MouseEvent,
    id: string,
    name: string
  ) => {
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

  const renderWorkspaceItem = (ws: (typeof workspaces)[0]) => (
    <div
      key={ws.id}
      onClick={() => ws.status === "active" && handleSwitch(ws.id)}
      className={`group flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer transition-colors ${
        ws.id === activeWorkspaceId
          ? "text-indigo-400 bg-zinc-800"
          : ws.status === "archived"
            ? "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50"
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
          <WorkspaceStatusBadge workspaceId={ws.id} />
          <span className="flex-1 truncate">{ws.name}</span>
          {ws.branch && (
            <span className="flex items-center gap-0.5 text-[10px] text-zinc-600 shrink-0">
              <GitBranch size={8} />
              <span className="truncate max-w-[60px]">{ws.branch}</span>
            </span>
          )}
          {ws.status === "active" && (
            <>
              <button
                onClick={(e) => handleStartRename(e, ws.id, ws.name)}
                className="p-0.5 text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100"
                title="Rename"
              >
                <Pencil size={10} />
              </button>
              <button
                onClick={(e) => handleArchive(e, ws.id)}
                className="p-0.5 text-zinc-500 hover:text-amber-400 opacity-0 group-hover:opacity-100"
                title="Archive workspace"
              >
                <Archive size={10} />
              </button>
            </>
          )}
          {ws.status === "archived" && (
            <button
              onClick={(e) => handleRestore(e, ws.id)}
              className="p-0.5 text-zinc-500 hover:text-green-400 opacity-0 group-hover:opacity-100"
              title="Restore workspace"
            >
              <RotateCcw size={10} />
            </button>
          )}
          {workspaces.length > 1 && (
            <button
              onClick={(e) => handleDelete(e, ws.id)}
              className="p-0.5 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100"
              title="Delete workspace"
            >
              <Trash2 size={10} />
            </button>
          )}
        </>
      )}
    </div>
  );

  return (
    <>
      <div
        ref={ref}
        className="relative px-2 py-1.5 border-b border-[var(--color-panel-border)]"
      >
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 w-full px-2 py-1 text-xs rounded-md hover:bg-zinc-800 transition-colors"
        >
          <Layers size={12} className="text-indigo-400 shrink-0" />
          <span className="text-zinc-300 truncate flex-1 text-left">
            {activeWorkspace?.name ?? "No workspace"}
          </span>
          {activeWorkspace?.branch && (
            <span className="flex items-center gap-0.5 text-[10px] text-zinc-500 shrink-0">
              <GitBranch size={9} />
              <span className="truncate max-w-[80px]">
                {activeWorkspace.branch}
              </span>
            </span>
          )}
          <ChevronDown
            size={12}
            className={`text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div className="absolute left-2 right-2 top-full mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl py-1 max-h-80 overflow-auto">
            {activeWorkspaces.map(renderWorkspaceItem)}

            {archivedWorkspaces.length > 0 && (
              <>
                <div className="px-3 py-1 mt-1 text-[10px] uppercase tracking-wider text-zinc-600 font-semibold border-t border-zinc-800">
                  Archived
                </div>
                {archivedWorkspaces.map(renderWorkspaceItem)}
              </>
            )}

            <div className="border-t border-zinc-700 mt-1 pt-1">
              <button
                onClick={() => {
                  setOpen(false);
                  setShowCreateDialog(true);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                <Plus size={11} />
                New Workspace
              </button>
            </div>
          </div>
        )}
      </div>

      <CreateWorkspaceDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={handleCreateWorkspace}
      />
    </>
  );
}
