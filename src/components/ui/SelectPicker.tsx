import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import { ChevronDown, Search } from "lucide-react";

export interface SelectPickerOption {
  value: string;
  label: string;
  group?: string;
  badge?: string;
}

interface SelectPickerProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectPickerOption[];
  placeholder?: string;
  icon?: ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
}

export function SelectPicker({
  value,
  onChange,
  options,
  placeholder = "Select...",
  icon,
  searchable = false,
  searchPlaceholder = "Filter...",
  className = "",
}: SelectPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  // Group options if any have a group property
  const hasGroups = filtered.some((o) => o.group);
  const groups = useMemo(() => {
    if (!hasGroups) return null;
    const map = new Map<string, SelectPickerOption[]>();
    for (const o of filtered) {
      const g = o.group || "";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(o);
    }
    return map;
  }, [filtered, hasGroups]);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch("");
  };

  const handleToggle = () => {
    setOpen((prev) => {
      if (prev) setSearch("");
      return !prev;
    });
  };

  const renderOption = (o: SelectPickerOption) => (
    <button
      key={o.value}
      type="button"
      onClick={() => handleSelect(o.value)}
      className={`w-full text-left px-3 py-1.5 text-[13px] transition-colors ${
        value === o.value
          ? "text-indigo-400 bg-indigo-500/10"
          : "text-zinc-300 hover:bg-zinc-800/80"
      }`}
    >
      {o.label}
      {o.badge && (
        <span className="ml-2 text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
          {o.badge}
        </span>
      )}
    </button>
  );

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center justify-between w-full px-3 py-2.5 text-[13px] bg-zinc-900/60 border border-zinc-700/60 rounded-lg text-zinc-200 cursor-pointer hover:border-zinc-600 transition-all duration-150"
      >
        <span className="flex items-center gap-1.5 truncate">
          {icon}
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          size={12}
          className={`shrink-0 text-zinc-500 transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-zinc-900 border border-zinc-700/80 rounded-lg shadow-xl shadow-black/40 max-h-60 flex flex-col overflow-hidden">
          {searchable && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
              <Search size={13} className="text-zinc-500 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="flex-1 bg-transparent text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                autoFocus
              />
            </div>
          )}

          <div className="overflow-y-auto py-1">
            {groups
              ? Array.from(groups.entries()).map(([group, items]) => (
                  <div key={group}>
                    {group && (
                      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">
                        {group}
                      </div>
                    )}
                    {items.map(renderOption)}
                  </div>
                ))
              : filtered.map(renderOption)}
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-[13px] text-zinc-600 text-center">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
