import { XtermTerminal } from "./XtermTerminal";

export function TerminalPanel() {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#09090b]">
      <XtermTerminal />
    </div>
  );
}
