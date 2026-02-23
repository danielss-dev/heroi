// Terminal output/exit notification system.
// The orchestrator subscribes here; XtermTerminal calls the notify functions.

type OutputCallback = (data: string) => void;
type ExitCallback = (exitCode: number) => void;

const outputListeners = new Map<string, OutputCallback[]>();
const exitListeners = new Map<string, ExitCallback[]>();

export function registerOutputListener(
  tabId: string,
  cb: OutputCallback
): () => void {
  const existing = outputListeners.get(tabId) ?? [];
  existing.push(cb);
  outputListeners.set(tabId, existing);
  return () => {
    const cbs = outputListeners.get(tabId) ?? [];
    outputListeners.set(
      tabId,
      cbs.filter((c) => c !== cb)
    );
  };
}

export function registerExitListener(
  tabId: string,
  cb: ExitCallback
): () => void {
  const existing = exitListeners.get(tabId) ?? [];
  existing.push(cb);
  exitListeners.set(tabId, existing);
  return () => {
    const cbs = exitListeners.get(tabId) ?? [];
    exitListeners.set(
      tabId,
      cbs.filter((c) => c !== cb)
    );
  };
}

export function notifyOutput(tabId: string, data: string) {
  const cbs = outputListeners.get(tabId) ?? [];
  for (const cb of cbs) {
    try {
      cb(data);
    } catch {
      /* ignore listener errors */
    }
  }
}

export function notifyExit(tabId: string, exitCode: number) {
  const cbs = exitListeners.get(tabId) ?? [];
  for (const cb of cbs) {
    try {
      cb(exitCode);
    } catch {
      /* ignore listener errors */
    }
  }
}

export function removeAllListeners(tabId: string) {
  outputListeners.delete(tabId);
  exitListeners.delete(tabId);
}
