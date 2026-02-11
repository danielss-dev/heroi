import type { RepoEntry } from "../../types";
import { RepoItem } from "./RepoItem";

interface RepoListProps {
  repos: RepoEntry[];
}

export function RepoList({ repos }: RepoListProps) {
  if (repos.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-xs text-zinc-500">No repositories added yet.</p>
        <p className="text-xs text-zinc-600 mt-1">
          Click "Add Repository" below to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {repos.map((repo) => (
        <RepoItem key={repo.path} repo={repo} />
      ))}
    </div>
  );
}
