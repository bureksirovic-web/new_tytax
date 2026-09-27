'use client';
import { useT } from '@/lib/i18n/use-t';
import type { SlotEditorState } from './use-slot-editor';

/** Icon glyphs (not copy); the button's name comes from aria-label. */
const CHECK_GLYPH = '✓';
const ADD_GLYPH = '+';

/**
 * Session slots whose exercise id is missing from the catalog. They never show
 * up in the filtered results, so they are listed here (selected by default)
 * with the stored name and a working toggle; saving keeps or drops the stored slot.
 */
export function UnknownSlots({ ed }: { ed: SlotEditorState }) {
  const { t } = useT();
  if (ed.unknownSlots.length === 0) return null;
  return (
    <section aria-labelledby="slot-unknown-heading" className="mb-4 rounded-xl border border-dashed border-line p-3">
      <h2 id="slot-unknown-heading" className="text-xs font-semibold uppercase tracking-widest text-fg">
        {t('prog_slot_unknown_heading')}
      </h2>
      <p className="mb-2 text-xs text-fg-muted">{t('prog_slot_unknown_hint')}</p>
      <ul className="flex flex-col gap-2" data-testid="slot-unknown">
        {ed.unknownSlots.map(({ id, name }) => {
          const label = name || t('prog_slot_unknown_name', { id });
          const selected = ed.selected.includes(id);
          return (
            <li key={id}>
              <button
                type="button"
                aria-pressed={selected}
                aria-label={t(selected ? 'prog_slot_remove' : 'prog_slot_add', { name: label })}
                onClick={() => ed.toggle(id)}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  selected ? 'border-accent bg-bg-2' : 'border-line bg-card hover:bg-card-hover'
                }`}
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{label}</span>
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm ${selected ? 'border-accent bg-accent text-white' : 'border-line text-fg-muted'}`}
                >
                  {selected ? CHECK_GLYPH : ADD_GLYPH}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
