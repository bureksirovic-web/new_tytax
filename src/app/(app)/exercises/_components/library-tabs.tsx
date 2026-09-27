'use client';
import { useT } from '@/lib/i18n/use-t';

const STAR = '★';

interface LibraryTabsProps {
  favorites: boolean;
  arsenalCount: number | undefined;
  onChange: (favorites: boolean) => void;
}

const base =
  'flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400';

/** All | Arsenal segmented control (Arsenal = favourites, `?favorites=1`). */
export function LibraryTabs({ favorites, arsenalCount, onChange }: LibraryTabsProps) {
  const { t } = useT();
  const cls = (on: boolean) => `${base} ${on ? 'bg-accent text-white' : 'text-fg-2 hover:bg-card-hover hover:text-fg'}`;
  return (
    <div role="group" aria-label={t('ex_tabs_label')} className="flex gap-1 rounded-xl border border-line bg-bg-2 p-1">
      <button type="button" aria-pressed={!favorites} className={cls(!favorites)} onClick={() => onChange(false)}>
        {t('ex_tab_all')}
      </button>
      <button type="button" data-testid="exercise-tab-arsenal" aria-pressed={favorites} className={cls(favorites)} onClick={() => onChange(true)}>
        <span aria-hidden="true">{STAR}</span>
        {arsenalCount === undefined ? t('ex_tab_arsenal') : t('ex_arsenal_count', { n: arsenalCount })}
      </button>
    </div>
  );
}
