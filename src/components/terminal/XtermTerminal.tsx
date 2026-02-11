import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { spawn } from "tauri-pty";
import type { IPty } from "tauri-pty";
import "@xterm/xterm/css/xterm.css";
import { useAppStore } from "../../stores/useAppStore";
import { getAgentById, getAgentArgs } from "../../lib/agents";

// Module-level PTY state
let activePty: IPty | null = null;
let activeDisposers: Array<{ dispose: () => void }> = [];

function killPty() {
  activeDisposers.forEach((d) => {
    try { d.dispose(); } catch { /* ignore */ }
  });
  activeDisposers = [];
  if (activePty !== null) {
    try { activePty.kill(); } catch { /* ignore */ }
    activePty = null;
  }
}

function spawnInWorktree(
  command: string,
  args: string[],
  cwd: string,
  term: Terminal,
  spawnKeyRef: React.MutableRefObject<string | null>,
  key: string
) {
  killPty();
  term.clear();
  term.reset();
  spawnKeyRef.current = key;

  try {
    const pty = spawn(command, args, {
      cols: term.cols,
      rows: term.rows,
      cwd,
      env: { TERM: "xterm-256color" },
    });

    activePty = pty;

    // PTY output -> Terminal
    const dataDisp = pty.onData((data) => {
      term.write(new Uint8Array(data));
    });
    activeDisposers.push(dataDisp);

    // PTY exit
    const exitDisp = pty.onExit(({ exitCode }) => {
      term.write(
        `\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`
      );
      if (activePty === pty) {
        activePty = null;
        spawnKeyRef.current = null;
      }
    });
    activeDisposers.push(exitDisp);

    // Terminal input -> PTY
    const inputDisp = term.onData((data) => {
      pty.write(data);
    });
    activeDisposers.push(inputDisp);

    // Terminal resize -> PTY
    const resizeDisp = term.onResize((e) => {
      pty.resize(e.cols, e.rows);
    });
    activeDisposers.push(resizeDisp);

    term.focus();
  } catch (err) {
    term.write(`\x1b[31mFailed to spawn "${command}": ${err}\x1b[0m\r\n`);
    term.write(`\x1b[90mMake sure "${command}" is installed and in your PATH.\x1b[0m\r\n`);
    spawnKeyRef.current = null;
  }
}

export function XtermTerminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const spawnKeyRef = useRef<string | null>(null);

  const selectedWorktree = useAppStore((s) => s.selectedWorktree);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId);
  const agents = useAppStore((s) => s.agents);
  const agentArgsConfig = useAppStore((s) => s.settings.agentArgs);

  // Initialize xterm once
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
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
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(containerRef.current);
    requestAnimationFrame(() => {
      try { fitAddon.fit(); } catch { /* ignore */ }
    });

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    return () => {
      killPty();
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      spawnKeyRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle container resize — fit xterm to container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      const fit = fitAddonRef.current;
      if (fit) {
        try { fit.fit(); } catch { /* ignore */ }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Spawn PTY when worktree or agent changes
  useEffect(() => {
    const term = terminalRef.current;
    if (!selectedWorktree || !term) return;

    const agent = getAgentById(agents, selectedAgentId);
    if (!agent) return;

    const settings = useAppStore.getState().settings;
    const args = getAgentArgs(agent, settings);
    const key = `${selectedWorktree.path}::${selectedAgentId}`;
    if (spawnKeyRef.current === key) return;

    spawnInWorktree(agent.command, args, selectedWorktree.path, term, spawnKeyRef, key);
  }, [selectedWorktree, selectedAgentId, agents, agentArgsConfig]);

  // "Run" button forces respawn
  useEffect(() => {
    const handler = () => {
      const term = terminalRef.current;
      const state = useAppStore.getState();
      const { selectedWorktree: worktree, selectedAgentId: agentId, agents: agentsList, settings } = state;
      if (!term || !worktree) return;

      const agent = getAgentById(agentsList, agentId);
      if (!agent) return;

      const args = getAgentArgs(agent, settings);
      spawnKeyRef.current = null;
      const key = `${worktree.path}::${agentId}`;
      spawnInWorktree(agent.command, args, worktree.path, term, spawnKeyRef, key);
    };

    window.addEventListener("heroi:respawn-agent", handler);
    return () => window.removeEventListener("heroi:respawn-agent", handler);
  }, []);

  return (
    <div ref={containerRef} className="xterm-container flex-1 min-h-0" />
  );
}
