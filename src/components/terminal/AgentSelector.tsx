import { Bot } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { Dropdown } from "../ui/Dropdown";

export function AgentSelector() {
  const { agents, selectedAgentId, setSelectedAgentId } = useAppStore();

  const items = agents.map((a) => ({
    id: a.id,
    label: a.name,
    icon: <Bot size={12} />,
  }));

  return (
    <Dropdown
      items={items}
      value={selectedAgentId}
      onChange={setSelectedAgentId}
      placeholder="Select Agent"
    />
  );
}
