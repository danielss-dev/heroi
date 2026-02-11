import { useState, useRef, useEffect, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface DropdownItem {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface DropdownProps {
  items: DropdownItem[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}

export function Dropdown({ items, value, onChange, placeholder }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = items.find((i) => i.id === value);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-7 px-2.5 text-xs rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
      >
        {selected?.icon}
        <span>{selected?.label || placeholder || "Select..."}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[160px] bg-zinc-900 border border-zinc-700 rounded-md shadow-xl py-1">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onChange(item.id);
                setOpen(false);
              }}
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left transition-colors ${
                item.id === value
                  ? "text-indigo-400 bg-zinc-800"
                  : "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
