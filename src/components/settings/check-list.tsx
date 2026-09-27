'use client';
import { useId } from 'react';

export interface CheckItem {
  id: string;
  label: string;
  checked: boolean;
}

/** A labelled group of checkboxes (44px rows). */
export function CheckList({
  legend,
  items,
  onToggle,
  testIdPrefix,
  disabled = false,
}: {
  legend: string;
  items: readonly CheckItem[];
  onToggle: (id: string, checked: boolean) => void;
  testIdPrefix: string;
  disabled?: boolean;
}) {
  const base = useId();
  return (
    <fieldset className="space-y-1" disabled={disabled}>
      <legend className="mb-1 text-xs font-medium uppercase tracking-wider text-fg-muted">{legend}</legend>
      <ul className="grid gap-1 sm:grid-cols-2">
        {items.map((item) => {
          const id = `${base}-${item.id}`;
          return (
            <li key={item.id}>
              <label
                htmlFor={id}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg bg-card px-3 text-sm text-fg hover:bg-card-hover has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-tactical-amber-400"
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={item.checked}
                  data-testid={`${testIdPrefix}-${item.id}`}
                  onChange={(e) => onToggle(item.id, e.target.checked)}
                  className="h-5 w-5 accent-od-green-500 focus-visible:outline-none"
                />
                {item.label}
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
