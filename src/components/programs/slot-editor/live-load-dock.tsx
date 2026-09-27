'use client';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/use-t';
import { MUSCLE_KEYS } from '../lib/labels';
import { liveLoadByGroup, pushPullRatio } from '@/lib/programs/load';
import type { SlotEditorState } from './use-slot-editor';

const BAR_H = 48;

/** Sticky dock: selected count, 10 live-load bars (tap = muscle filter), push:pull ratio, save. */
export function LiveLoadDock({ ed, saving, onSave }: { ed: SlotEditorState; saving: boolean; onSave: () => void }) {
  const { t } = useT();
  const loads = liveLoadByGroup(ed.selectedExercises);
  const pp = pushPullRatio(ed.selectedExercises);
  const loaded = loads.filter((l) => l.score > 0).sort((a, b) => b.score - a.score);
  const summary = loaded.length
    ? t('prog_slot_load_summary', {
        summary: loaded.map((l) => t('prog_slot_load_bar', { group: t(MUSCLE_KEYS[l.group]), pct: Math.round(l.pct) })).join(', '),
      })
    : t('prog_slot_load_none');

  return (
    <section aria-labelledby="slot-dock-heading" className="sticky bottom-16 z-10 mt-6 rounded-xl border border-line bg-bg-2 p-3 shadow-lg md:bottom-2" data-testid="live-load-dock">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="slot-dock-heading" className="text-xs font-semibold uppercase tracking-widest text-fg">
          {t('prog_slot_live_load')} · <span role="status">{t('prog_slot_selected', { n: ed.selected.length })}</span>
        </h2>
        <Button size="sm" variant="primary" loading={saving} disabled={saving} onClick={onSave}>
          {t('prog_slot_save')}
        </Button>
      </div>
      <p className="sr-only" aria-live="polite">
        {summary}
      </p>
      <ul className="mt-2 grid grid-cols-10 gap-1">
        {loads.map((l) => {
          const h = Math.max(2, (l.pct / 100) * BAR_H);
          const label = t(MUSCLE_KEYS[l.group]);
          return (
            <li key={l.group}>
              <button
                type="button"
                onClick={() => ed.setFilter(ed.hidden.has(l.group) ? { muscle: l.group, smart: false } : { muscle: l.group })}
                aria-label={t('prog_slot_load_bar', { group: label, pct: Math.round(l.pct) })}
                className="flex min-h-11 w-full flex-col items-center justify-end rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <svg width="100%" height={BAR_H} aria-hidden="true" focusable="false">
                  <rect x="15%" y={BAR_H - h} width="70%" height={h} rx={2} className={l.pct >= 100 ? 'fill-emerald-500' : 'fill-indigo-400'} />
                </svg>
                <span aria-hidden="true" className="w-full truncate text-center text-[10px] text-fg-muted">
                  {label.slice(0, 3)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className={`mt-2 text-xs ${pp.imbalanced ? 'text-amber-300' : 'text-fg-muted'}`} role={pp.imbalanced ? 'alert' : undefined}>
        {pp.imbalanced ? t('prog_slot_push_pull_warn', { push: pp.push, pull: pp.pull }) : t('prog_slot_push_pull', { push: pp.push, pull: pp.pull })}
      </p>
    </section>
  );
}
