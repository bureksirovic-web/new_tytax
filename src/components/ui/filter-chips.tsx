'use client';

interface FilterChipsProps<T extends string> {
  options: Array<{ value: T; label: string; count?: number }>;
  selected: T[];
  onChange: (selected: T[]) => void;
  multi?: boolean;
  className?: string;
  /** Accessible name for the chip group. */
  ariaLabel?: string;
}

const base =
  'flex min-h-11 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400';
const activeCls = 'border-accent bg-accent text-white';
const idleCls = 'border-line bg-bg-2 text-fg-2 hover:bg-card-hover hover:text-fg';

export function FilterChips<T extends string>({ options, selected, onChange, multi = true, className = '', ariaLabel }: FilterChipsProps<T>) {
  const toggle = (value: T) => {
    if (!multi) {
      onChange(selected[0] === value ? [] : [value]);
      return;
    }
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className}`} role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`${base} ${active ? activeCls : idleCls}`}
            aria-pressed={active}
          >
            {opt.label}
            {opt.count !== undefined && <span className="ml-0.5">{opt.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
