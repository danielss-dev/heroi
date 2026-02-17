import { Plus, Minus } from "lucide-react";
import type { GitFileStatus } from "../../types";
import { GitFileItem } from "./GitFileItem";
import { FileTreeGroup } from "./FileTreeGroup";

interface GitStatusListProps {
  files: GitFileStatus[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  onStage: (path: string) => void;
  onUnstage: (path: string) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  worktreePath: string;
}

function groupByDirectory(files: GitFileStatus[]) {
  const groups: Record<string, GitFileStatus[]> = {};
  for (const file of files) {
    const lastSlash = file.path.lastIndexOf("/");
    const dir = lastSlash >= 0 ? file.path.substring(0, lastSlash) : ".";
    if (!groups[dir]) groups[dir] = [];
    groups[dir].push(file);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

function renderFileGroup(
  files: GitFileStatus[],
  selectedFile: string | null,
  onSelectFile: (path: string) => void,
  onStage: (path: string) => void,
  onUnstage: (path: string) => void,
  worktreePath: string
) {
  const groups = groupByDirectory(files);

  if (groups.length <= 1) {
    return files.map((f) => (
      <GitFileItem
        key={f.path}
        file={f}
        isSelected={selectedFile === f.path}
        onSelect={onSelectFile}
        onStage={onStage}
        onUnstage={onUnstage}
        worktreePath={worktreePath}
      />
    ));
  }

  return groups.map(([dir, dirFiles]) => (
    <FileTreeGroup key={dir} directory={dir}>
      {dirFiles.map((f) => (
        <GitFileItem
          key={f.path}
          file={f}
          isSelected={selectedFile === f.path}
          onSelect={onSelectFile}
          onStage={onStage}
          onUnstage={onUnstage}
          worktreePath={worktreePath}
        />
      ))}
    </FileTreeGroup>
  ));
}

export function GitStatusList({
  files,
  selectedFile,
  onSelectFile,
  onStage,
  onUnstage,
  onStageAll,
  onUnstageAll,
  worktreePath,
}: GitStatusListProps) {
  const staged = files.filter((f) => f.staged !== "Unmodified");
  const unstaged = files.filter((f) => f.unstaged !== "Unmodified");

  if (files.length === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <p className="text-xs text-zinc-500">No changes detected</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {staged.length > 0 && (
        <div>
          <div className="flex items-center px-3 py-1">
            <span className="text-[10px] uppercase tracking-wider text-green-500 font-semibold flex-1">
              Staged ({staged.length})
            </span>
            <button
              onClick={onUnstageAll}
              className="p-0.5 text-zinc-500 hover:text-orange-400 transition-colors"
              title="Unstage all"
            >
              <Minus size={12} />
            </button>
          </div>
          {renderFileGroup(
            staged,
            selectedFile,
            onSelectFile,
            onStage,
            onUnstage,
            worktreePath
          )}
        </div>
      )}
      {unstaged.length > 0 && (
        <div>
          <div className="flex items-center px-3 py-1">
            <span className="text-[10px] uppercase tracking-wider text-yellow-500 font-semibold flex-1">
              Changes ({unstaged.length})
            </span>
            <button
              onClick={onStageAll}
              className="p-0.5 text-zinc-500 hover:text-green-400 transition-colors"
              title="Stage all"
            >
              <Plus size={12} />
            </button>
          </div>
          {renderFileGroup(
            unstaged,
            selectedFile,
            onSelectFile,
            onStage,
            onUnstage,
            worktreePath
          )}
        </div>
      )}
    </div>
  );
}
