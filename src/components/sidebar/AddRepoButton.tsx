import { Plus } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useRepos } from "../../hooks/useRepos";

export function AddRepoButton() {
  const { addRepo } = useRepos();

  const handleClick = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Git Repository",
    });

    if (selected) {
      try {
        await addRepo(selected as string);
      } catch (err) {
        console.error("Failed to add repo:", err);
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
    >
      <Plus size={14} />
      Add Repository
    </button>
  );
}
