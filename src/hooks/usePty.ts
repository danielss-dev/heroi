import { useCallback, useRef } from "react";
import { spawn } from "tauri-pty";
import type { Terminal } from "@xterm/xterm";
import { useTerminalStore } from "../stores/useTerminalStore";
import { DEFAULT_TERMINAL_COLS, DEFAULT_TERMINAL_ROWS } from "../lib/constants";

interface IPty {
  pid: number;
  cols: number;
  rows: number;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: (signal?: string) => void;
  onData: (listener: (data: Uint8Array) => void) => { dispose: () => void };
  onExit: (
    listener: (data: { exitCode: number; signal?: number }) => void
  ) => { dispose: () => void };
}

export function usePty() {
  const ptyRef = useRef<IPty | null>(null);
  const disposersRef = useRef<Array<{ dispose: () => void }>>([]);
  const { setSession, removeSession } = useTerminalStore();

  const spawnPty = useCallback(
    (
      command: string,
      args: string[],
      cwd: string,
      agentId: string,
      terminal: Terminal
    ) => {
      // Kill existing PTY if any
      killPty();

      const cols = terminal.cols || DEFAULT_TERMINAL_COLS;
      const rows = terminal.rows || DEFAULT_TERMINAL_ROWS;

      const pty = spawn(command, args, {
        cols,
        rows,
        cwd,
      }) as unknown as IPty;

      ptyRef.current = pty;

      // PTY -> Terminal
      const dataDisposer = pty.onData((data: Uint8Array) => {
        const text = new TextDecoder().decode(data);
        terminal.write(text);
      });
      disposersRef.current.push(dataDisposer);

      // Terminal -> PTY
      const termDisposer = terminal.onData((data: string) => {
        pty.write(data);
      });
      disposersRef.current.push(termDisposer);

      // Exit handler
      const exitDisposer = pty.onExit(
        (ev: { exitCode: number; signal?: number }) => {
          terminal.write(
            `\r\n\x1b[90m[Process exited with code ${ev.exitCode}]\x1b[0m\r\n`
          );
          removeSession(cwd);
        }
      );
      disposersRef.current.push(exitDisposer);

      const sessionId = `${cwd}-${Date.now()}`;
      setSession(cwd, {
        id: sessionId,
        worktreePath: cwd,
        agentId,
        pid: pty.pid,
      });

      return pty;
    },
    [setSession, removeSession]
  );

  const writePty = useCallback((data: string) => {
    ptyRef.current?.write(data);
  }, []);

  const resizePty = useCallback((cols: number, rows: number) => {
    ptyRef.current?.resize(cols, rows);
  }, []);

  const killPty = useCallback(() => {
    disposersRef.current.forEach((d) => d.dispose());
    disposersRef.current = [];
    if (ptyRef.current) {
      try {
        ptyRef.current.kill();
      } catch {
        // Process may already be dead
      }
      ptyRef.current = null;
    }
  }, []);

  return { spawnPty, writePty, resizePty, killPty, ptyRef };
}
