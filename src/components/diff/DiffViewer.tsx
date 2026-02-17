import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { gitDiffAll } from "../../lib/tauri";
import type { DiffOutput } from "../../types";
import { DiffFileTree } from "./DiffFileTree";
import { UnifiedDiff } from "./UnifiedDiff";

export function DiffViewer() {
  const selectedWorktree = useAppStore((s) => s.selectedWorktree);
  const [diffs, setDiffs] = useState<DiffOutput[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDiffs = useCallback(async () => {
    if (!selectedWorktree) return;
    setLoading(true);
    try {
      const result = await gitDiffAll(selectedWorktree.path);
      setDiffs(result);
      // Auto-select first file if current selection is gone
      if (result.length > 0) {
        if (!selectedFile || !result.find((d) => d.file_path === selectedFile)) {
          setSelectedFile(result[0].file_path);
        }
      } else {
        setSelectedFile(null);
      }
    } catch (err) {
      console.error("Failed to load diffs:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedWorktree, selectedFile]);

  useEffect(() => {
    loadDiffs();
  }, [selectedWorktree]);

  const selectedDiff = diffs.find((d) => d.file_path === selectedFile);

  return (
    <div className="flex h-full">
      {/* File tree sidebar */}
      <div className="w-56 shrink-0 border-r border-zinc-800 flex flex-col bg-[#0c0c0e]">
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
          <span className="text-xs font-semibold text-zinc-300">
            Diff Viewer
          </span>
          <button
            onClick={loadDiffs}
            disabled={loading}
            className="p-1 text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800 transition-colors"
            title="Refresh diffs"
          >
            <RefreshCw
              size={12}
              className={loading ? "animate-spin" : ""}
            />
          </button>
        </div>
        <DiffFileTree
          diffs={diffs}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
        />
      </div>

      {/* Diff content */}
      <div className="flex-1 min-w-0 bg-[#09090b]">
        {selectedDiff ? (
          <div className="flex flex-col h-full">
            <div className="px-3 py-2 border-b border-zinc-800 text-xs text-zinc-400 font-mono truncate">
              {selectedDiff.file_path}
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <UnifiedDiff
                diffText={selectedDiff.diff_text}
                filePath={selectedDiff.file_path}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
            {diffs.length === 0
              ? "No changes in workspace"
              : "Select a file to view diff"}
          </div>
        )}
      </div>
    </div>
  );
}
