'use client';
import type { Exercise, Station } from '@/contracts/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/use-t';
import { patternKey } from '@/lib/i18n/pattern';
import { MODALITY_KEYS, MUSCLE_KEYS, stationKey } from '../lib/labels';
import { stationIdOf } from '../lib/slot-filter';
import type { SlotEditorState } from './use-slot-editor';

/** Icon glyphs (not copy); the button's name comes from aria-label. */
const CHECK_GLYPH = '✓';
const ADD_GLYPH = '+';

function ExerciseOption({ ex, stations, selected, onToggle }: { ex: Exercise; stations: readonly Station[]; selected: boolean; onToggle: () => void }) {
  const { t } = useT();
  const sid = stationIdOf(ex, stations);
  const sKey = sid ? stationKey(sid) : undefined;
  const pKey = patternKey(ex.pattern);
  const pattern = pKey ? t(pKey) : ex.pattern || t('prog_slot_isolation');
  const badge = sKey ? t(sKey) : ex.modality === 'tytax' ? t('prog_station_free_weight') : t(MODALITY_KEYS[ex.modality]);
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        aria-label={t(selected ? 'prog_slot_remove' : 'prog_slot_add', { name: ex.name })}
        onClick={onToggle}
        className={`flex min-h-16 w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          selected ? 'border-accent bg-bg-2' : 'border-line bg-card hover:bg-card-hover'
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-fg">{ex.name}</span>
          <span className="block text-xs text-fg-muted">
            {pattern} · {t(MUSCLE_KEYS[ex.muscleGroup])}
          </span>
          <span className="mt-1 flex flex-wrap gap-1">
            <Badge variant={ex.modality}>{badge}</Badge>
            {ex.isUnilateral ? <Badge>{t('prog_slot_unilateral')}</Badge> : null}
          </span>
        </span>
        <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm ${selected ? 'border-accent bg-accent text-white' : 'border-line text-fg-muted'}`}>
          {selected ? CHECK_GLYPH : ADD_GLYPH}
        </span>
      </button>
    </li>
  );
}

/** Paginated result list with the legacy empty state (No matches → Show all / Clear all filters). */
export function SlotResults({ ed }: { ed: SlotEditorState }) {
  const { t } = useT();
  const stations = ed.catalog?.stations ?? [];
  const shown = ed.results.slice(0, ed.visible);
  const remaining = ed.results.length - shown.length;

  if (ed.results.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line p-6 text-center" data-testid="slot-empty">
        <p className="font-semibold text-fg">{t('prog_slot_no_matches')}</p>
        <p className="mt-1 text-sm text-fg-muted">{t('prog_slot_filter_empty', { filter: t(MUSCLE_KEYS[ed.filter.muscle]) })}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => ed.setFilter({ muscle: 'ALL' })}>
            {t('prog_slot_show_all')}
          </Button>
          <Button size="sm" variant="ghost" onClick={ed.clearFilters}>
            {t('prog_slot_clear_filters')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p role="status" aria-live="polite" className="mb-2 text-xs text-fg-muted">
        {t('prog_slot_results', { n: ed.results.length })}
      </p>
      <ul className="flex flex-col gap-2" data-testid="slot-results">
        {shown.map((ex) => (
          <ExerciseOption key={ex.id} ex={ex} stations={stations} selected={ed.selected.includes(ex.id)} onToggle={() => ed.toggle(ex.id)} />
        ))}
      </ul>
      {remaining > 0 ? (
        <Button className="mt-3" fullWidth variant="secondary" onClick={ed.showMore}>
          {t('prog_slot_load_more', { n: remaining })}
        </Button>
      ) : null}
    </div>
  );
}
