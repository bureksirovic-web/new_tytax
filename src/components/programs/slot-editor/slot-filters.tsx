'use client';
import type { Modality } from '@/contracts/domain';
import { FilterChips } from '@/components/ui/filter-chips';
import { SearchBar } from '@/components/ui/search-bar';
import { useT } from '@/lib/i18n/use-t';
import { MODALITY_KEYS, MUSCLE_KEYS, stationKey } from '../lib/labels';
import { MUSCLE_CHIPS, type MuscleChip } from '@/lib/programs/session-kind';
import type { SlotEditorState } from './use-slot-editor';

const MODALITIES: ReadonlyArray<Modality | 'all'> = ['all', 'tytax', 'bodyweight', 'kettlebell'];

function Toggle({ id, checked, label, onChange }: { id: string; checked: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-fg-2 hover:bg-card-hover">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-current focus-visible:ring-2 focus-visible:ring-accent" />
      {label}
    </label>
  );
}

/** Search, modality, muscle chips (smart-filter hiding), station chips, toggles. */
export function SlotFilters({ ed }: { ed: SlotEditorState }) {
  const { t } = useT();
  const { filter, setFilter } = ed;
  const stations = ed.catalog?.stations ?? [];
  const showStations = stations.length > 0 && (filter.modality === 'all' || filter.modality === 'tytax');
  const chips = MUSCLE_CHIPS.filter((c) => !ed.hidden.has(c)).map((c) => ({ value: c, label: t(MUSCLE_KEYS[c]) }));

  return (
    <div className="space-y-3">
      <div role="search" aria-label={t('prog_slot_search_label')}>
        <SearchBar value={ed.textInput} onChange={ed.setTextInput} placeholder={t('prog_slot_search')} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="slot-modality" className="text-xs text-fg-muted">
          {t('prog_slot_modality_filter')}
        </label>
        <select
          id="slot-modality"
          value={filter.modality}
          onChange={(e) => setFilter({ modality: e.target.value as Modality | 'all', stationId: null })}
          className="min-h-11 rounded-lg border border-line bg-bg-2 px-3 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {MODALITIES.map((m) => (
            <option key={m} value={m}>
              {t(MODALITY_KEYS[m])}
            </option>
          ))}
        </select>
      </div>
      <FilterChips<MuscleChip>
        ariaLabel={t('prog_slot_muscle_filter')}
        options={chips}
        selected={[filter.muscle]}
        multi={false}
        onChange={(v) => setFilter({ muscle: v[0] ?? 'ALL' })}
      />
      {showStations ? (
        <FilterChips<string>
          ariaLabel={t('prog_slot_station_filter')}
          options={stations.map((s) => {
            const key = stationKey(s.id);
            return { value: s.id, label: key ? t(key) : s.name };
          })}
          selected={filter.stationId ? [filter.stationId] : []}
          multi={false}
          onChange={(v) => setFilter({ stationId: v[0] ?? null })}
        />
      ) : null}
      <fieldset className="flex flex-wrap gap-x-2">
        <legend className="sr-only">{t('prog_slot_options')}</legend>
        <Toggle id="slot-smart" checked={filter.smart} label={t('prog_slot_smart_filter')} onChange={(v) => setFilter({ smart: v })} />
        <Toggle id="slot-owned" checked={filter.ownedOnly} label={t('prog_slot_owned_only')} onChange={(v) => setFilter({ ownedOnly: v })} />
        <Toggle id="slot-fav" checked={filter.favouritesOnly} label={t('prog_slot_favourites_only')} onChange={(v) => setFilter({ favouritesOnly: v })} />
      </fieldset>
    </div>
  );
}
