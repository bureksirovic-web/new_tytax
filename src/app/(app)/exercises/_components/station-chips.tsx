'use client';
import { useT } from '@/lib/i18n/use-t';
import { labelOr, stationKey } from './labels';
import type { EquipmentOption } from './use-equipment-options';
import '@/lib/i18n/packs/exercises';

interface StationChipsProps {
  /** Stations from the loaded catalog (`catalog.stations`, those with exercises), in catalog order. */
  stations: readonly EquipmentOption[];
  /** Counts under the other active filters; falls back to each station's catalog count. */
  counts: ReadonlyMap<string, number> | undefined;
  value: string | undefined;
  onChange: (stationId: string | undefined) => void;
}

const base =
  'flex min-h-11 flex-shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400';
const activeCls = 'border-accent bg-accent text-white';
const idleCls = 'border-line bg-bg-2 text-fg-2 hover:bg-card-hover hover:text-fg';

/**
 * Single-choice station chips, data-driven from the catalog (new stations
 * such as FRAME / FREE_WEIGHT appear with no code change). "All" clears it.
 */
export function StationChips({ stations, counts, value, onChange }: StationChipsProps) {
  const { t } = useT();
  const selected = value && stations.some((s) => s.id === value) ? value : undefined;
  const chip = (id: string | undefined, label: string, count?: number) => {
    const active = selected === id;
    return (
      <li key={id ?? '__all'}>
        <button
          type="button"
          data-testid={`exercise-station-chip-${id ?? 'all'}`}
          aria-pressed={active}
          aria-label={count === undefined ? label : t('ex_station_chip_label', { name: label, n: count })}
          onClick={() => onChange(active ? undefined : id)}
          className={`${base} ${active ? activeCls : idleCls}`}
        >
          <span>{label}</span>
          {count !== undefined && (
            <span aria-hidden="true" className="font-mono opacity-80">
              {count}
            </span>
          )}
        </button>
      </li>
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-1" role="group" aria-label={t('ex_filter_station')} data-testid="exercise-filter-station">
      <span aria-hidden="true" className="font-display text-xs font-medium uppercase tracking-wider text-fg-muted">
        {t('ex_filter_station')}
      </span>
      <ul className="flex flex-wrap gap-2">
        {chip(undefined, t('ex_filter_all'))}
        {stations.map((s) => chip(s.id, labelOr(t, stationKey(s.id), s.name), counts?.get(s.id) ?? s.count))}
      </ul>
    </div>
  );
}
