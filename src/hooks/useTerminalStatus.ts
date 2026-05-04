import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { listTerminals, type TerminalRunStatus } from "../lib/tauri";

type Status = TerminalRunStatus | "idle";

/**
 * Tracks the live terminal run status for a conversation. Refreshes on
 * mount, listens for the terminal exit event, and exposes a re-fetch.
 */
export function useTerminalStatus(conversationId: string | null): Status {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (!conversationId) {
      setStatus("idle");
      return;
    }
    let cancelled = false;

    const refresh = async () => {
      try {
        const list = await listTerminals();
        if (cancelled) return;
        const found = list.find((t) => t.conversationId === conversationId);
        setStatus(found ? found.status : "idle");
      } catch {
        if (!cancelled) setStatus("idle");
      }
    };

    void refresh();

    const unlistenExit = listen<number>(
      `terminal://${conversationId}/exit`,
      () => {
        if (!cancelled) setStatus("exited");
      }
    );
    const unlistenData = listen<string>(
      `terminal://${conversationId}/data`,
      () => {
        if (!cancelled) setStatus("running");
      }
    );

    return () => {
      cancelled = true;
      void unlistenExit.then((u) => u());
      void unlistenData.then((u) => u());
    };
  }, [conversationId]);

  return status;
}
