import type { GitFileStatus } from "../../types";
import { GitFileItem } from "./GitFileItem";

interface GitStatusListProps {
  files: GitFileStatus[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  onStage: (path: string) => void;
  onUnstage: (path: string) => void;
}

export function GitStatusList({
  files,
  selectedFile,
  onSelectFile,
  onStage,
  onUnstage,
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
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-green-500 font-semibold">
            Staged ({staged.length})
          </div>
          {staged.map((f) => (
            <GitFileItem
              key={`staged-${f.path}`}
              file={f}
              isSelected={selectedFile === f.path}
              onSelect={onSelectFile}
              onStage={onStage}
              onUnstage={onUnstage}
            />
          ))}
        </div>
      )}
      {unstaged.length > 0 && (
        <div>
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-yellow-500 font-semibold">
            Changes ({unstaged.length})
          </div>
          {unstaged.map((f) => (
            <GitFileItem
              key={`unstaged-${f.path}`}
              file={f}
              isSelected={selectedFile === f.path}
              onSelect={onSelectFile}
              onStage={onStage}
              onUnstage={onUnstage}
            />
          ))}
        </div>
      )}
    </div>
  );
}
