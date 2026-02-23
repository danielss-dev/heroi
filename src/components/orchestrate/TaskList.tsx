import { Plus } from "lucide-react";
import { Button } from "../ui/Button";
import { TaskCard } from "./TaskCard";
import { useOrchestrateStore } from "../../stores/useOrchestrateStore";
import type { OrchestrateTask } from "../../types/orchestrate";

interface TaskListProps {
  orchestrationId: string;
  tasks: OrchestrateTask[];
  editable?: boolean;
}

export function TaskList({ orchestrationId, tasks, editable }: TaskListProps) {
  const {
    selectedTaskId,
    setSelectedTask,
    updateTask,
    removeTask,
  } = useOrchestrateStore();

  const handleAddTask = () => {
    const title = prompt("Task title:");
    if (!title) return;
    const description = prompt("Task description:") ?? "";

    const store = useOrchestrateStore.getState();
    const orchestration = store.orchestrations.find((o) => o.id === orchestrationId);
    if (!orchestration) return;

    const newTask: OrchestrateTask = {
      id: crypto.randomUUID(),
      title,
      description,
      complexity: "medium",
      status: "pending",
      outputLog: "",
    };
    store.setTasks(orchestrationId, [...orchestration.tasks, newTask]);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Tasks ({tasks.length})
        </span>
        {editable && (
          <Button variant="ghost" size="sm" onClick={handleAddTask}>
            <Plus size={12} />
            Add
          </Button>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="text-xs text-zinc-600 py-4 text-center">
          No tasks yet. Waiting for plan generation...
        </div>
      ) : (
        tasks.map((task, i) => (
          <TaskCard
            key={task.id}
            task={task}
            index={i}
            selected={task.id === selectedTaskId}
            editable={editable}
            onSelect={() => setSelectedTask(task.id)}
            onRemove={
              editable
                ? () => removeTask(orchestrationId, task.id)
                : undefined
            }
            onEdit={
              editable
                ? (title, description) =>
                    updateTask(orchestrationId, task.id, { title, description })
                : undefined
            }
          />
        ))
      )}
    </div>
  );
}
