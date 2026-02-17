import { useState } from "react";
import { RotateCcw, Trash2, Plus, Clock, FileText } from "lucide-react";
import { Button } from "../ui/Button";
import { useCheckpoints } from "../../hooks/useCheckpoints";

export function CheckpointTimeline() {
  const { checkpoints, loading, create, restore, remove } = useCheckpoints();
  const [newLabel, setNewLabel] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = async () => {
    if (!newLabel.trim()) return;
    await create(newLabel.trim());
    setNewLabel("");
    setShowCreate(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-300">
          Checkpoints
        </span>
        <Button
          variant="ghost"
          size="icon"
          title="Create checkpoint"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus size={12} />
        </Button>
      </div>

      {showCreate && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Checkpoint label..."
            className="flex-1 h-7 px-2 text-xs rounded bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <Button
            variant="default"
            size="sm"
            disabled={!newLabel.trim() || loading}
            onClick={handleCreate}
          >
            Save
          </Button>
        </div>
      )}

      {checkpoints.length === 0 ? (
        <p className="text-[11px] text-zinc-600 py-2">
          No checkpoints yet. Create one to snapshot current state.
        </p>
      ) : (
        <div className="space-y-0">
          {checkpoints.map((cp, idx) => (
            <div key={cp.id} className="flex items-start gap-2 group">
              {/* Timeline line */}
              <div className="flex flex-col items-center pt-1">
                <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                {idx < checkpoints.length - 1 && (
                  <div className="w-px flex-1 bg-zinc-700 min-h-[24px]" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-200 truncate">
                    {cp.label}
                  </span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => restore(cp.git_ref)}
                      disabled={loading}
                      className="p-1 text-zinc-500 hover:text-amber-400 rounded transition-colors"
                      title="Restore to this checkpoint"
                    >
                      <RotateCcw size={10} />
                    </button>
                    <button
                      onClick={() => remove(cp.id)}
                      disabled={loading}
                      className="p-1 text-zinc-500 hover:text-red-400 rounded transition-colors"
                      title="Delete checkpoint"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                  <span className="flex items-center gap-0.5">
                    <Clock size={8} />
                    {cp.created_at.replace("T", " ").replace("Z", "")}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <FileText size={8} />
                    {cp.file_count} files
                  </span>
                  <span className="font-mono">{cp.git_ref.slice(0, 7)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
