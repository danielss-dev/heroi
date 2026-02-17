import { useState, useEffect, useCallback } from "react";
import {
  FolderOpen,
  Folder,
  FileCode,
  FileText,
  FileImage,
  FileJson,
  File,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { listDirectory, readFile } from "../../lib/tauri";
import type { DirEntry, FileContent, FileType } from "../../types";

function getFileIcon(fileType: FileType, isDir: boolean) {
  if (isDir) return Folder;
  switch (fileType) {
    case "Code":
      return FileCode;
    case "Markdown":
      return FileText;
    case "Image":
      return FileImage;
    case "Json":
      return FileJson;
    default:
      return File;
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

interface TreeNodeProps {
  entry: DirEntry;
  depth: number;
  onSelectFile: (path: string) => void;
  selectedFile: string | null;
}

function TreeNode({ entry, depth, onSelectFile, selectedFile }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<DirEntry[]>([]);

  const toggle = async () => {
    if (!entry.is_dir) {
      onSelectFile(entry.path);
      return;
    }
    if (!expanded) {
      try {
        const entries = await listDirectory(entry.path);
        setChildren(entries);
      } catch {
        setChildren([]);
      }
    }
    setExpanded(!expanded);
  };

  const Icon = getFileIcon(entry.file_type, entry.is_dir);
  const isSelected = entry.path === selectedFile;

  return (
    <div>
      <button
        onClick={toggle}
        className={`flex items-center gap-1.5 w-full text-left py-0.5 px-2 text-xs transition-colors hover:bg-zinc-800/50 ${
          isSelected ? "bg-zinc-800 text-zinc-100" : "text-zinc-400"
        }`}
        style={{ paddingLeft: depth * 16 + 8 }}
      >
        {entry.is_dir ? (
          expanded ? (
            <ChevronDown size={10} className="shrink-0 text-zinc-600" />
          ) : (
            <ChevronRight size={10} className="shrink-0 text-zinc-600" />
          )
        ) : (
          <span className="w-[10px] shrink-0" />
        )}
        <Icon
          size={12}
          className={`shrink-0 ${
            entry.is_dir
              ? expanded
                ? "text-indigo-400"
                : "text-zinc-500"
              : "text-zinc-500"
          }`}
        />
        <span className="truncate flex-1">{entry.name}</span>
        {!entry.is_dir && entry.size > 0 && (
          <span className="text-[9px] text-zinc-600 shrink-0">
            {formatSize(entry.size)}
          </span>
        )}
      </button>
      {expanded &&
        children.map((child) => (
          <TreeNode
            key={child.path}
            entry={child}
            depth={depth + 1}
            onSelectFile={onSelectFile}
            selectedFile={selectedFile}
          />
        ))}
    </div>
  );
}

export function FileBrowser() {
  const selectedWorktree = useAppStore((s) => s.selectedWorktree);
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<FileContent | null>(null);

  const loadRoot = useCallback(async () => {
    if (!selectedWorktree) {
      setEntries([]);
      return;
    }
    try {
      const items = await listDirectory(selectedWorktree.path);
      setEntries(items);
    } catch {
      setEntries([]);
    }
  }, [selectedWorktree]);

  useEffect(() => {
    loadRoot();
    setSelectedFile(null);
    setFileContent(null);
  }, [loadRoot]);

  useEffect(() => {
    if (!selectedFile) {
      setFileContent(null);
      return;
    }
    readFile(selectedFile)
      .then(setFileContent)
      .catch(() => setFileContent(null));
  }, [selectedFile]);

  return (
    <div className="flex h-full">
      {/* File tree */}
      <div className="w-56 shrink-0 border-r border-zinc-800 flex flex-col bg-[#0c0c0e]">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
          <FolderOpen size={12} className="text-zinc-500" />
          <span className="text-xs font-semibold text-zinc-300">Files</span>
        </div>
        <div className="flex-1 overflow-auto py-1">
          {entries.map((entry) => (
            <TreeNode
              key={entry.path}
              entry={entry}
              depth={0}
              onSelectFile={setSelectedFile}
              selectedFile={selectedFile}
            />
          ))}
          {entries.length === 0 && (
            <div className="px-3 py-4 text-xs text-zinc-600 text-center">
              No files found
            </div>
          )}
        </div>
      </div>

      {/* File preview */}
      <div className="flex-1 min-w-0 bg-[#09090b]">
        {fileContent ? (
          <div className="flex flex-col h-full">
            <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-mono truncate">
                {fileContent.path.replace(selectedWorktree?.path + "/", "")}
              </span>
              <span className="text-[10px] text-zinc-600 shrink-0">
                {formatSize(fileContent.size)} &middot; {fileContent.file_type}
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              {fileContent.file_type === "Image" ? (
                <div className="flex items-center justify-center h-full p-4">
                  <div className="text-xs text-zinc-500">
                    Image preview not available in terminal mode
                  </div>
                </div>
              ) : fileContent.file_type === "Binary" ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-xs text-zinc-500">
                    Binary file ({formatSize(fileContent.size)})
                  </div>
                </div>
              ) : (
                <pre className="p-3 text-xs text-zinc-300 font-mono whitespace-pre-wrap break-words leading-relaxed">
                  {fileContent.content}
                </pre>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
            Select a file to preview
          </div>
        )}
      </div>
    </div>
  );
}
