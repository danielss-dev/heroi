import { GitPullRequest, GitMerge, CircleX } from "lucide-react";

interface PrStatusBadgeProps {
  state: string;
  draft: boolean;
  number: number;
}

export function PrStatusBadge({ state, draft, number }: PrStatusBadgeProps) {
  const colorMap: Record<string, string> = {
    OPEN: draft ? "text-zinc-400 bg-zinc-800" : "text-green-400 bg-green-900/30",
    MERGED: "text-purple-400 bg-purple-900/30",
    CLOSED: "text-red-400 bg-red-900/30",
  };

  const iconMap: Record<string, typeof GitPullRequest> = {
    OPEN: GitPullRequest,
    MERGED: GitMerge,
    CLOSED: CircleX,
  };

  const color = colorMap[state] ?? "text-zinc-400 bg-zinc-800";
  const Icon = iconMap[state] ?? GitPullRequest;

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}
    >
      <Icon size={10} />
      #{number} {draft ? "Draft" : state.toLowerCase()}
    </span>
  );
}
