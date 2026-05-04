import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { listen } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";
import { Wrench } from "lucide-react";
import type { Conversation, Settings } from "../../types";
import { useAppStore } from "../../stores/useAppStore";
import { useConversationStore } from "../../stores/useConversationStore";
import { useProjectStore } from "../../stores/useProjectStore";
import { getAgentArgs, getAgentById } from "../../lib/agents";
import { CommandQuickList } from "../commands/CommandQuickList";
import {
  listTerminals,
  terminalInput,
  terminalLoadScrollback,
  terminalResize,
  terminalSpawn,
  terminalKill,
} from "../../lib/tauri";

const TERM_OPTIONS = {
  cursorBlink: true,
  convertEol: true,
  fontSize: 13,
  fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
  theme: {
    background: "#09090b",
    foreground: "#e4e4e7",
    cursor: "#e4e4e7",
    selectionBackground: "#6366f140",
    black: "#18181b",
    red: "#ef4444",
    green: "#22c55e",
    yellow: "#eab308",
    blue: "#6366f1",
    magenta: "#a855f7",
    cyan: "#06b6d4",
    white: "#e4e4e7",
    brightBlack: "#52525b",
    brightRed: "#f87171",
    brightGreen: "#4ade80",
    brightYellow: "#facc15",
    brightBlue: "#818cf8",
    brightMagenta: "#c084fc",
    brightCyan: "#22d3ee",
    brightWhite: "#fafafa",
  },
  allowProposedApi: true,
} as const;

function buildEnv(conv: Conversation, settings: Settings): Record<string, string> {
  const providerEnv: Record<string, string> = {};
  for (const p of settings.providers ?? []) {
    if (p.enabled && p.apiKey) {
      providerEnv[p.envVarName] = p.apiKey;
      if (p.baseUrl) {
        const baseUrlKey = p.envVarName.replace(/_API_KEY$/, "_BASE_URL");
        if (baseUrlKey !== p.envVarName) {
          providerEnv[baseUrlKey] = p.baseUrl;
        }
      }
    }
  }
  return {
    TERM: "xterm-256color",
    HEROI_AGENT_ID: conv.agentId,
    ...providerEnv,
    ...conv.envVars,
  };
}

interface Props {
  conversation: Conversation;
}

export function ConversationTerminal({ conversation }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const setStatus = useConversationStore((s) => s.setStatus);
  const project = useProjectStore((s) =>
    s.projects.find((p) => p.id === conversation.projectId)
  );
  const [commandsOpen, setCommandsOpen] = useState(false);

  // Mount: build the xterm instance for this conversation.
  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    const terminal = new Terminal(TERM_OPTIONS);
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.loadAddon(new WebLinksAddon());
    terminal.open(parent);
    termRef.current = terminal;
    fitRef.current = fit;

    requestAnimationFrame(() => {
      try {
        fit.fit();
      } catch {
        /* ignore */
      }
      terminal.focus();
    });

    let disposed = false;
    const disposers: Array<() => void> = [];

    const inputDisp = terminal.onData((data) => {
      void terminalInput(conversation.id, data).catch(() => {});
    });
    disposers.push(() => inputDisp.dispose());

    const resizeDisp = terminal.onResize(({ cols, rows }) => {
      void terminalResize(conversation.id, cols, rows).catch(() => {});
    });
    disposers.push(() => resizeDisp.dispose());

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        /* ignore */
      }
    });
    ro.observe(parent);
    disposers.push(() => ro.disconnect());

    const panelHandler = () => {
      try {
        fit.fit();
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("heroi:panel-resize", panelHandler);
    disposers.push(() =>
      window.removeEventListener("heroi:panel-resize", panelHandler)
    );

    // Listen for live PTY events from the backend.
    const dataUnlistenP = listen<string>(
      `terminal://${conversation.id}/data`,
      (e) => {
        terminal.write(e.payload);
      }
    );
    const exitUnlistenP = listen<number>(
      `terminal://${conversation.id}/exit`,
      (e) => {
        terminal.write(
          `\r\n\x1b[90m[Process exited with code ${e.payload}]\x1b[0m\r\n`
        );
        setStatus(conversation.id, "exited");
      }
    );

    // Hydrate scrollback + spawn (or attach) the agent.
    void (async () => {
      try {
        const sb = await terminalLoadScrollback(conversation.id);
        if (disposed) return;
        if (sb && sb.ringBuffer) {
          terminal.write(sb.ringBuffer);
        }
      } catch {
        /* ignore */
      }

      let alreadyRunning = false;
      try {
        const list = await listTerminals();
        alreadyRunning = list.some(
          (t) => t.conversationId === conversation.id && t.status === "running"
        );
      } catch {
        /* ignore */
      }
      if (disposed) return;

      if (alreadyRunning) {
        setStatus(conversation.id, "running");
        return;
      }

      const { agents, settings } = useAppStore.getState();
      const agent = getAgentById(agents, conversation.agentId);
      if (!agent) {
        terminal.write(
          `\r\n\x1b[31mAgent "${conversation.agentId}" is not configured.\x1b[0m\r\n`
        );
        return;
      }
      const args = getAgentArgs(agent, settings);
      const env = buildEnv(conversation, settings);

      try {
        await terminalSpawn(
          conversation.id,
          agent.command,
          args,
          conversation.workingDir.path,
          env,
          terminal.cols,
          terminal.rows
        );
        setStatus(conversation.id, "running");
      } catch (err) {
        terminal.write(
          `\r\n\x1b[31mFailed to spawn ${agent.command}: ${err}\x1b[0m\r\n`
        );
        setStatus(conversation.id, "exited");
      }
    })();

    return () => {
      disposed = true;
      for (const d of disposers) d();
      void dataUnlistenP.then((u) => u());
      void exitUnlistenP.then((u) => u());
      terminal.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  const handleRestart = async () => {
    const term = termRef.current;
    if (!term) return;
    const { agents, settings } = useAppStore.getState();
    const agent = getAgentById(agents, conversation.agentId);
    if (!agent) return;

    try {
      await terminalKill(conversation.id);
    } catch {
      /* ignore — terminal may already be dead */
    }

    term.clear();
    term.reset();

    const args = getAgentArgs(agent, settings);
    const env = buildEnv(conversation, settings);
    try {
      await terminalSpawn(
        conversation.id,
        agent.command,
        args,
        conversation.workingDir.path,
        env,
        term.cols,
        term.rows
      );
      setStatus(conversation.id, "running");
    } catch (err) {
      term.write(`\r\n\x1b[31mFailed to spawn ${agent.command}: ${err}\x1b[0m\r\n`);
      setStatus(conversation.id, "exited");
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-[#09090b]">
      <div className="flex items-center gap-2 px-3 py-1 border-b border-zinc-800 bg-zinc-950 shrink-0">
        <span className="text-[11px] uppercase tracking-wider text-zinc-500">
          {conversation.agentId}
        </span>
        <span className="text-xs text-zinc-300 truncate">
          {conversation.name}
        </span>
        <span className="ml-auto flex items-center gap-2 relative">
          {project && (
            <button
              onClick={() => setCommandsOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-100 px-2 py-0.5 rounded hover:bg-zinc-800"
              title="Project commands"
            >
              <Wrench size={11} />
              Commands
            </button>
          )}
          <button
            onClick={handleRestart}
            className="text-[11px] text-zinc-400 hover:text-zinc-100 px-2 py-0.5 rounded hover:bg-zinc-800"
            title="Kill and respawn the agent"
          >
            Restart
          </button>
          {project && commandsOpen && (
            <CommandQuickList
              conversation={conversation}
              project={project}
              onClose={() => setCommandsOpen(false)}
            />
          )}
        </span>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0 min-w-0" />
    </div>
  );
}
