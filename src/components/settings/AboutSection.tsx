import { useEffect, useState } from "react";
import { RefreshCw, Plug } from "lucide-react";
import {
  HEROI_SCHEMA_VERSION,
  type Settings,
} from "../../types";
import { getMcpPort, getSchemaVersion } from "../../lib/tauri";
import { runMigration } from "../../lib/migration";
import { useProjectStore } from "../../stores/useProjectStore";
import { useConversationStore } from "../../stores/useConversationStore";

interface Props {
  settings: Settings;
}

export function AboutSection({ settings }: Props) {
  const [schemaVersion, setSchemaVersion] = useState<number | null>(null);
  const [mcpPort, setMcpPort] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshInfo = async () => {
    try {
      const [v, p] = await Promise.all([getSchemaVersion(), getMcpPort()]);
      setSchemaVersion(v);
      setMcpPort(p);
    } catch (err) {
      console.error("Failed to load about info", err);
    }
  };

  useEffect(() => {
    void refreshInfo();
  }, []);

  const handleReRunMigration = async () => {
    if (busy) return;
    setBusy(true);
    setReport(null);
    setError(null);
    try {
      const r = await runMigration(settings);
      await Promise.all([
        useProjectStore.getState().refresh(),
        useConversationStore.getState().refresh(),
      ]);
      setReport(
        r.alreadyMigrated
          ? `Already at schema v${r.schemaVersionAfter}. Nothing to migrate.`
          : `Migrated to schema v${r.schemaVersionAfter}: ${r.projectsWritten} projects, ${r.conversationsWritten} conversations.`
      );
      void refreshInfo();
    } catch (err) {
      setError(typeof err === "string" ? err : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const mcpUrl = mcpPort != null ? `http://127.0.0.1:${mcpPort}/rpc` : null;

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div>
        <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
          Schema
        </h3>
        <div className="grid grid-cols-[140px_1fr] gap-y-1 text-xs">
          <span className="text-zinc-400">Current</span>
          <span className="text-zinc-200 font-mono">
            {schemaVersion ?? "…"}
          </span>
          <span className="text-zinc-400">Expected</span>
          <span className="text-zinc-200 font-mono">{HEROI_SCHEMA_VERSION}</span>
        </div>
        <button
          onClick={handleReRunMigration}
          disabled={busy}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500 text-zinc-100"
        >
          <RefreshCw size={12} className={busy ? "animate-spin" : ""} />
          {busy ? "Running…" : "Re-run migration"}
        </button>
        {report && (
          <div className="mt-2 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-900 rounded px-2 py-1">
            {report}
          </div>
        )}
        {error && (
          <div className="mt-2 text-xs text-red-400 bg-red-950/40 border border-red-900 rounded px-2 py-1">
            {error}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800 pt-4">
        <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-1.5 flex items-center gap-1.5">
          <Plug size={11} />
          MCP server
        </h3>
        <div className="grid grid-cols-[140px_1fr] gap-y-1 text-xs">
          <span className="text-zinc-400">URL</span>
          <span className="text-zinc-200 font-mono break-all">
            {mcpUrl ?? "(not running)"}
          </span>
        </div>
        <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
          Spawned agents receive <code className="text-zinc-300">HEROI_MCP_URL</code> +{" "}
          <code className="text-zinc-300">HEROI_CONVERSATION_ID</code> in their
          environment. See <code className="text-zinc-300">docs/mcp-setup.md</code>.
        </p>
      </div>
    </div>
  );
}
