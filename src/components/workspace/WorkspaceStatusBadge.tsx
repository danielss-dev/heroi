import { useTerminalStore } from "../../stores/useTerminalStore";

interface WorkspaceStatusBadgeProps {
  workspaceId: string;
}

export function WorkspaceStatusBadge({
  workspaceId,
}: WorkspaceStatusBadgeProps) {
  const hasRunning = useTerminalStore((s) => s.hasRunningSession(workspaceId));

  if (!hasRunning) return null;

  return (
    <span
      className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0"
      title="Agent running"
    />
  );
}
