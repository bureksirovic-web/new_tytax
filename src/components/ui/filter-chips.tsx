'use client';

interface FilterChipsProps<T extends string> {
  options: Array<{ value: T; label: string; count?: number }>;
  selected: T[];
  onChange: (selected: T[]) => void;
  multi?: boolean;
  className?: string;
}

export function FilterChips<T extends string>({ options, selected, onChange, multi = true, className = '' }: FilterChipsProps<T>) {
  const toggle = (value: T) => {
    if (!multi) {
      onChange(selected[0] === value ? [] : [value]);
      return;
    }
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => toggle(opt.value)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[32px] border"
            style={{
              backgroundColor: active ? 'var(--accent)' : 'var(--bg-secondary)',
              borderColor: active ? 'var(--accent)' : 'var(--border-color)',
              color: active ? 'white' : 'var(--text-secondary)',
            }}
            aria-pressed={active}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span className="opacity-70 ml-0.5">{opt.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
