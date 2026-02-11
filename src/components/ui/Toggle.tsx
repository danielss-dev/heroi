interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-indigo-500" : "bg-zinc-600"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4.5" : "translate-x-0.5"
          }`}
        />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-zinc-200 group-hover:text-zinc-100">
          {label}
        </div>
        {description && (
          <div className="text-xs text-zinc-500 mt-0.5">{description}</div>
        )}
      </div>
    </label>
  );
}
