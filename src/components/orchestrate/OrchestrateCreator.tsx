import { useState, useEffect, useMemo, useCallback } from "react";
import { Sparkles, ChevronDown, Image, X, GitBranch, FolderGit2, Cpu, ArrowRight, Layers } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { SelectPicker, type SelectPickerOption } from "../ui/SelectPicker";
import { useAppStore } from "../../stores/useAppStore";
import { useOrchestrateStore } from "../../stores/useOrchestrateStore";
import { engine } from "../../lib/orchestrateEngine";
import { listBranches, getDefaultBranch, createWorkspaceWithWorktree, copyFile, writeBinaryFile } from "../../lib/tauri";
import type { BranchInfo } from "../../types";

interface AttachedImage {
  id: string;
  name: string;
  /** Object URL for clipboard images, empty for file-dialog images */
  previewUrl: string;
  /** Absolute path on disk (file-dialog images only) */
  sourcePath?: string;
  /** Blob data (clipboard images only) */
  blob?: Blob;
}

export function OrchestrateCreator() {
  const repos = useAppStore((s) => s.repos);
  const agents = useAppStore((s) => s.agents);
  const activeWorkspace = useAppStore((s) => {
    const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
    return ws;
  });

  const [name, setName] = useState("");
  const [featureDescription, setFeatureDescription] = useState("");
  const [repoPath, setRepoPath] = useState(activeWorkspace?.repoPath ?? repos[0]?.path ?? "");
  const [baseBranch, setBaseBranch] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("");
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [planAgentId, setPlanAgentId] = useState("claude");
  const [devAgentId, setDevAgentId] = useState("claude");
  const [reviewAgentId, setReviewAgentId] = useState("claude");
  const [maxParallel, setMaxParallel] = useState(2);
  const [creating, setCreating] = useState(false);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewImage, setPreviewImage] = useState<AttachedImage | null>(null);

  const canCreate = name.trim() && featureDescription.trim() && repoPath;

  const agentOptions = agents.filter((a) => a.id !== "shell");

  // Load branches when repo changes
  useEffect(() => {
    if (!repoPath) return;

    getDefaultBranch(repoPath)
      .then((b) => {
        setDefaultBranch(b);
        setBaseBranch(b);
      })
      .catch(() => {
        setDefaultBranch("main");
        setBaseBranch("main");
      });

    listBranches(repoPath)
      .then(setBranches)
      .catch(() => setBranches([]));
  }, [repoPath]);

  // Build picker options from repos
  const repoOptions: SelectPickerOption[] = repos.map((r) => ({
    value: r.path,
    label: r.name,
  }));

  // Build picker options from branches (grouped)
  const branchOptions: SelectPickerOption[] = useMemo(
    () =>
      branches.map((b) => ({
        value: b.name,
        label: b.name,
        group: b.is_remote ? "Remote" : "Local",
        badge: b.is_head ? "HEAD" : undefined,
      })),
    [branches]
  );

  // Build agent picker options
  const agentPickerOptions: SelectPickerOption[] = agentOptions.map((a) => ({
    value: a.id,
    label: a.name,
  }));

  const [error, setError] = useState<string | null>(null);

  const handleAttachImages = async () => {
    const selected = await open({
      multiple: true,
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"],
        },
      ],
    });
    if (selected) {
      const paths = Array.isArray(selected) ? selected : [selected];
      const newImages: AttachedImage[] = paths.map((p) => ({
        id: crypto.randomUUID(),
        name: p.replace(/\\/g, "/").split("/").pop() ?? "image",
        previewUrl: "",
        sourcePath: p,
      }));
      setAttachedImages((prev) => [...prev, ...newImages]);
    }
  };

  const handleRemoveImage = (id: string) => {
    setAttachedImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img?.previewUrl) URL.revokeObjectURL(img.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          const previewUrl = URL.createObjectURL(blob);
          const ext = item.type.split("/")[1] || "png";
          const name = `clipboard-${Date.now()}.${ext}`;
          setAttachedImages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), name, previewUrl, blob },
          ]);
        }
        break;
      }
    }
  }, []);

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    setError(null);

    try {
      const store = useOrchestrateStore.getState();
      const orchestration = store.createOrchestration({
        name: name.trim(),
        repoPath,
        baseBranch: baseBranch || defaultBranch || "main",
        featureDescription: featureDescription.trim(),
        maxParallel,
        planAgentId,
        devAgentId,
        reviewAgentId,
      });

      // Create the orchestration worktree + branch upfront
      const branchName = `orch/${name.trim().replace(/\s+/g, "-").toLowerCase()}`;
      const config = await createWorkspaceWithWorktree(
        repoPath,
        `orch-${orchestration.id.slice(0, 8)}`,
        branchName,
        baseBranch || defaultBranch || "main"
      );

      store.updateOrchestration(orchestration.id, {
        planWorktreePath: config.worktree_path,
        planWorkspaceId: config.id,
      });

      // Copy attached images to .context/ in the worktree
      if (attachedImages.length > 0) {
        const contextPaths: string[] = [];
        for (const img of attachedImages) {
          const timestamp = Date.now();
          const relativePath = `.context/images/${timestamp}-${img.name}`;
          const destPath = `${config.worktree_path}/${relativePath}`;

          if (img.sourcePath) {
            // File-dialog image: copy from source path
            await copyFile(img.sourcePath, destPath);
          } else if (img.blob) {
            // Clipboard image: write blob data
            const arrayBuffer = await img.blob.arrayBuffer();
            const bytes = Array.from(new Uint8Array(arrayBuffer));
            await writeBinaryFile(bytes, destPath);
          }
          contextPaths.push(relativePath);
        }
        store.updateOrchestration(orchestration.id, {
          contextImages: contextPaths,
        });
      }

      // Start planning in the orchestration worktree
      await engine.startPlanning(orchestration.id);
    } catch (err) {
      setError(String(err));
      console.error("Failed to create orchestration:", err);
    }

    setCreating(false);
  };

  const inputClass =
    "w-full px-3 py-2.5 text-[13px] bg-zinc-900/60 border border-zinc-700/60 rounded-lg text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-all duration-150";
  const labelClass = "block text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full max-w-[640px] mx-auto px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/10 border border-indigo-500/20 shadow-sm shadow-indigo-500/5">
              <Sparkles size={18} className="text-indigo-400" />
            </div>
            <h2 className="text-[15px] font-semibold text-zinc-100 tracking-tight">
              New Orchestration
            </h2>
          </div>
          <p className="text-[13px] text-zinc-500 ml-12">
            Describe a feature and let AI plan, build, and review it.
          </p>
        </div>

        {/* Section 1: Describe */}
        <div className="space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Layers size={13} className="text-zinc-600" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">
              Describe
            </span>
          </div>

          {/* Name */}
          <div>
            <label className={labelClass}>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Add user authentication"
              className={inputClass}
            />
          </div>

          {/* Feature Description + Images */}
          <div>
            <label className={labelClass}>Feature Description</label>
            <textarea
              value={featureDescription}
              onChange={(e) => setFeatureDescription(e.target.value)}
              onPaste={handlePaste}
              placeholder="Describe the feature you want to build in detail...&#10;&#10;You can paste images directly here, or attach files below."
              rows={6}
              className={`${inputClass} resize-none leading-relaxed`}
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleAttachImages}
                className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 rounded-md border border-transparent hover:border-zinc-700/60 hover:bg-zinc-800/50 transition-all duration-150"
              >
                <Image size={12} />
                Attach Images
              </button>
            </div>
            {attachedImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {attachedImages.map((img) =>
                  img.previewUrl ? (
                    <div
                      key={img.id}
                      className="group relative w-20 h-20 rounded-lg border border-zinc-700/60 bg-zinc-800/50 overflow-hidden shadow-sm cursor-pointer"
                      onClick={() => setPreviewImage(img)}
                    >
                      <img
                        src={img.previewUrl}
                        alt={img.name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveImage(img.id); }}
                        className="absolute top-1 right-1 p-0.5 rounded-md bg-black/70 text-zinc-400 hover:text-zinc-100 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                      <div className="absolute bottom-0 inset-x-0 px-1.5 py-0.5 bg-gradient-to-t from-black/80 to-transparent text-[9px] text-zinc-400 truncate">
                        {img.name}
                      </div>
                    </div>
                  ) : (
                    <span
                      key={img.id}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] bg-zinc-800/50 border border-zinc-700/60 rounded-lg text-zinc-300"
                    >
                      <Image size={10} className="text-zinc-500 shrink-0" />
                      <span className="truncate max-w-[150px]">{img.name}</span>
                      <button
                        onClick={() => handleRemoveImage(img.id)}
                        className="text-zinc-500 hover:text-zinc-300 shrink-0 ml-0.5"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="my-7 border-t border-zinc-800/80" />

        {/* Section 2: Configure */}
        <div className="space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <FolderGit2 size={13} className="text-zinc-600" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">
              Target
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Repository</label>
              <SelectPicker
                value={repoPath}
                onChange={setRepoPath}
                options={repoOptions}
                placeholder="Select repository..."
                icon={<FolderGit2 size={12} className="text-zinc-500 shrink-0" />}
              />
            </div>
            <div>
              <label className={labelClass}>Base Branch</label>
              <SelectPicker
                value={baseBranch || defaultBranch}
                onChange={setBaseBranch}
                options={branchOptions}
                placeholder="Select branch..."
                icon={<GitBranch size={12} className="text-zinc-500 shrink-0" />}
                searchable
                searchPlaceholder="Filter branches..."
              />
            </div>
          </div>
        </div>

        {/* Advanced options */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors duration-150"
          >
            <ChevronDown
              size={12}
              className={`transition-transform duration-150 ${showAdvanced ? "rotate-0" : "-rotate-90"}`}
            />
            <Cpu size={12} />
            Advanced options
          </button>
          {showAdvanced && (
            <div className="mt-4 space-y-4 pl-4 border-l-2 border-zinc-800/80">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Plan Agent</label>
                  <SelectPicker
                    value={planAgentId}
                    onChange={setPlanAgentId}
                    options={agentPickerOptions}
                    placeholder="Select agent..."
                  />
                </div>
                <div>
                  <label className={labelClass}>Dev Agent</label>
                  <SelectPicker
                    value={devAgentId}
                    onChange={setDevAgentId}
                    options={agentPickerOptions}
                    placeholder="Select agent..."
                  />
                </div>
                <div>
                  <label className={labelClass}>Review Agent</label>
                  <SelectPicker
                    value={reviewAgentId}
                    onChange={setReviewAgentId}
                    options={agentPickerOptions}
                    placeholder="Select agent..."
                  />
                </div>
              </div>

              <div className="w-44">
                <label className={labelClass}>Parallel Developers</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={maxParallel}
                  onChange={(e) =>
                    setMaxParallel(
                      Math.max(1, Math.min(5, parseInt(e.target.value) || 1))
                    )
                  }
                  className={inputClass}
                />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-5 flex items-start gap-2 text-[13px] text-red-400 bg-red-500/5 border border-red-500/15 rounded-lg px-3.5 py-2.5">
            <X size={14} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="mt-8 pt-6 border-t border-zinc-800/80">
          <button
            onClick={handleCreate}
            disabled={!canCreate || creating}
            className="group w-full flex items-center justify-center gap-2.5 h-10 rounded-lg text-[13px] font-medium bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/50 shadow-sm shadow-indigo-500/10 disabled:opacity-40 disabled:pointer-events-none transition-all duration-150 cursor-pointer"
          >
            {creating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Sparkles size={15} className="opacity-80" />
                Create & Start Planning
                <ArrowRight size={14} className="opacity-60 group-hover:translate-x-0.5 transition-transform duration-150" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Image preview lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <X size={18} />
          </button>
          <img
            src={previewImage.previewUrl}
            alt={previewImage.name}
            className="max-w-[90vw] max-h-[85vh] rounded-lg shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-6 text-[13px] text-zinc-400">
            {previewImage.name}
          </div>
        </div>
      )}
    </div>
  );
}
